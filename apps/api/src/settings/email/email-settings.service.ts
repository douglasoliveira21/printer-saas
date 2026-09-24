import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SecretCryptoService } from '../../common/crypto/secret-crypto.service';
import type { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';

const STATE_MAX_AGE_MS = 15 * 60 * 1000; // 15min — só o tempo de completar o consentimento na Microsoft
const OAUTH_SCOPE = 'offline_access Mail.Send';

/**
 * Per-tenant e-mail provider config (SMTP or Microsoft 365 Graph). A tenant
 * that hasn't configured this yet keeps working exactly as before — the
 * worker's MailerService falls back to the global SMTP_HOST/* env vars when
 * no TenantEmailSettings row exists (see apps/worker/src/mailer/mailer.service.ts).
 *
 * Microsoft 365 usa OAuth2 delegado (Authorization Code + offline_access)
 * com o App Registration único da Plataforma (PlatformSettings) — o tenant
 * só faz login com a própria conta Microsoft e concede Mail.Send, nunca cria
 * nem cola credencial de app (ver m365TenantId/ClientId/ClientSecret legados
 * no schema, mantidos só por compatibilidade com quem já configurou assim).
 */
@Injectable()
export class EmailSettingsService {
  private readonly logger = new Logger(EmailSettingsService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly crypto: SecretCryptoService,
    private readonly config: ConfigService,
  ) {}

  async get() {
    const settings = await this.tenantPrisma.client.tenantEmailSettings.findFirst({});
    return this.toSummary(settings);
  }

  async update(dto: UpdateEmailSettingsDto) {
    const existing = await this.tenantPrisma.client.tenantEmailSettings.findFirst({});

    const data: Record<string, unknown> = {
      provider: dto.provider,
      smtpHost: dto.smtpHost,
      smtpPort: dto.smtpPort,
      smtpUser: dto.smtpUser,
      smtpFrom: dto.smtpFrom,
    };
    if (dto.smtpPassword) {
      data.smtpPasswordEncrypted = this.crypto.encrypt(dto.smtpPassword);
    }
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));

    const settings = existing
      ? await this.tenantPrisma.client.tenantEmailSettings.update({ where: { id: existing.id }, data: cleanData })
      : await this.tenantPrisma.client.tenantEmailSettings.create({ data: cleanData as any });

    return this.toSummary(settings);
  }

  private redirectUri() {
    return `${this.config.get<string>('API_URL', 'http://localhost:3001')}/api/v1/email-settings/m365/callback`;
  }

  /** Gera a URL de consentimento da Microsoft — o front só redireciona o navegador pra ela. */
  async getM365ConnectUrl() {
    const tenantId = this.tenantPrisma.tenantId;
    const platform = await this.prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    if (!platform?.m365ClientId || !platform.m365ClientSecretEncrypted) {
      throw new BadRequestException(
        'Conexão com Microsoft 365 ainda não está disponível — fale com o suporte (App Registration da Plataforma não configurado).',
      );
    }

    // Criptografia autenticada (mesma usada pra segredos) como assinatura do
    // state: garante que ninguém forje um tenantId diferente no callback, e
    // o timestamp embutido barra um state reaproveitado depois do prazo.
    const state = this.crypto.encrypt(`${tenantId}:${Date.now()}`);

    const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    url.searchParams.set('client_id', platform.m365ClientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.redirectUri());
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', OAUTH_SCOPE);
    url.searchParams.set('state', state);
    return { url: url.toString() };
  }

  /**
   * Callback público chamado pela própria Microsoft (redirect do navegador,
   * sem Authorization header) — a identidade do tenant vem só do `state`
   * assinado gerado em getM365ConnectUrl, nunca de sessão/JWT. Por isso usa
   * o Prisma cru (this.prisma), não o tenantPrisma escopado por request.
   * Retorna a URL pra onde o controller deve redirecionar o navegador.
   */
  async handleM365Callback(code: string | undefined, state: string | undefined): Promise<string> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const failureUrl = `${frontendUrl}/configuracoes/email?m365=error`;

    if (!code || !state) return failureUrl;

    const decoded = this.crypto.decrypt(state);
    if (!decoded) return failureUrl;
    const [tenantId, timestampRaw] = decoded.split(':');
    const timestamp = Number(timestampRaw);
    if (!tenantId || !Number.isFinite(timestamp) || Date.now() - timestamp > STATE_MAX_AGE_MS) {
      return failureUrl;
    }

    const platform = await this.prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    const clientSecret = platform?.m365ClientSecretEncrypted ? this.crypto.decrypt(platform.m365ClientSecretEncrypted) : null;
    if (!platform?.m365ClientId || !clientSecret) return failureUrl;

    try {
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: platform.m365ClientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri(),
          scope: OAUTH_SCOPE,
        }),
      });
      if (!tokenResponse.ok) {
        this.logger.error(`Falha ao trocar code por token (${tokenResponse.status}): ${await tokenResponse.text()}`);
        return failureUrl;
      }
      const tokenJson = (await tokenResponse.json()) as { access_token: string; refresh_token?: string };
      if (!tokenJson.refresh_token) {
        // Sem offline_access consentido (ou app mal configurado) — sem refresh token não dá pra manter a conexão.
        this.logger.error('Resposta de token da Microsoft não trouxe refresh_token');
        return failureUrl;
      }

      const meResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      const me = meResponse.ok ? ((await meResponse.json()) as { mail?: string; userPrincipalName?: string }) : null;
      const connectedEmail = me?.mail || me?.userPrincipalName || null;

      const existing = await this.prisma.tenantEmailSettings.findUnique({ where: { tenantId } });
      const data = {
        tenantId,
        provider: 'MICROSOFT365' as const,
        m365RefreshTokenEncrypted: this.crypto.encrypt(tokenJson.refresh_token),
        m365ConnectedEmail: connectedEmail,
        m365ConnectedAt: new Date(),
      };
      if (existing) {
        await this.prisma.tenantEmailSettings.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.tenantEmailSettings.create({ data });
      }

      return `${frontendUrl}/configuracoes/email?m365=connected`;
    } catch (error) {
      this.logger.error(`Erro no callback OAuth2 do Microsoft 365: ${(error as Error).message}`);
      return failureUrl;
    }
  }

  async disconnectM365() {
    const existing = await this.tenantPrisma.client.tenantEmailSettings.findFirst({});
    if (!existing) return this.toSummary(null);
    const settings = await this.tenantPrisma.client.tenantEmailSettings.update({
      where: { id: existing.id },
      data: { m365RefreshTokenEncrypted: null, m365ConnectedEmail: null, m365ConnectedAt: null },
    });
    return this.toSummary(settings);
  }

  /** Never exposes the encrypted secrets, let alone plaintext — only whether each is set. */
  private toSummary(
    settings: {
      provider: string;
      smtpHost: string | null;
      smtpPort: number | null;
      smtpUser: string | null;
      smtpPasswordEncrypted: string | null;
      smtpFrom: string | null;
      m365ConnectedEmail: string | null;
      m365ConnectedAt: Date | null;
      m365RefreshTokenEncrypted: string | null;
      updatedAt: Date;
    } | null,
  ) {
    if (!settings) {
      return {
        provider: 'SMTP' as const,
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        hasSmtpPassword: false,
        smtpFrom: null,
        m365ConnectedEmail: null,
        m365ConnectedAt: null,
        m365Connected: false,
        updatedAt: null,
      };
    }
    return {
      provider: settings.provider,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpUser: settings.smtpUser,
      hasSmtpPassword: !!settings.smtpPasswordEncrypted,
      smtpFrom: settings.smtpFrom,
      m365ConnectedEmail: settings.m365ConnectedEmail,
      m365ConnectedAt: settings.m365ConnectedAt,
      m365Connected: !!settings.m365RefreshTokenEncrypted,
      updatedAt: settings.updatedAt,
    };
  }
}
