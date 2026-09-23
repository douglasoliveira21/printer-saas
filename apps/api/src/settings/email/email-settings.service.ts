import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { SecretCryptoService } from '../../common/crypto/secret-crypto.service';
import type { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';

/**
 * Per-tenant e-mail provider config (SMTP or Microsoft 365 Graph). A tenant
 * that hasn't configured this yet keeps working exactly as before — the
 * worker's MailerService falls back to the global SMTP_HOST/* env vars when
 * no TenantEmailSettings row exists (see apps/worker/src/mailer/mailer.service.ts).
 */
@Injectable()
export class EmailSettingsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly crypto: SecretCryptoService,
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
      m365TenantId: dto.m365TenantId,
      m365ClientId: dto.m365ClientId,
      m365SenderUpn: dto.m365SenderUpn,
    };
    if (dto.smtpPassword) {
      data.smtpPasswordEncrypted = this.crypto.encrypt(dto.smtpPassword);
    }
    if (dto.m365ClientSecret) {
      data.m365ClientSecretEncrypted = this.crypto.encrypt(dto.m365ClientSecret);
    }
    const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));

    const settings = existing
      ? await this.tenantPrisma.client.tenantEmailSettings.update({ where: { id: existing.id }, data: cleanData })
      : await this.tenantPrisma.client.tenantEmailSettings.create({ data: cleanData as any });

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
      m365TenantId: string | null;
      m365ClientId: string | null;
      m365ClientSecretEncrypted: string | null;
      m365SenderUpn: string | null;
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
        m365TenantId: null,
        m365ClientId: null,
        hasM365ClientSecret: false,
        m365SenderUpn: null,
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
      m365TenantId: settings.m365TenantId,
      m365ClientId: settings.m365ClientId,
      hasM365ClientSecret: !!settings.m365ClientSecretEncrypted,
      m365SenderUpn: settings.m365SenderUpn,
      updatedAt: settings.updatedAt,
    };
  }
}
