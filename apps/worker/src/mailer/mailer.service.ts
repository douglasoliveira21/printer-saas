import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { SecretCryptoService } from '../common/secret-crypto.service';
import { sendViaGraph } from './graph-mailer';

/**
 * Per-tenant-aware mail sender. Each tenant can configure its own provider
 * in Configurações > E-mail (SMTP or Microsoft 365, see
 * TenantEmailSettings) — a tenant that hasn't configured anything falls
 * back to the global SMTP_HOST/* env vars (the only option before this
 * feature existed), so nothing that already worked stops working.
 */
@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private globalTransporter: Transporter | null = null;
  private globalFrom = 'no-reply@localhost';
  private readonly tenantTransporters = new Map<string, Transporter>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: SecretCryptoService,
  ) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn('SMTP_HOST não configurado — envio de e-mail desabilitado por padrão (tenants sem configuração própria em Configurações > E-mail não receberão nada).');
      return;
    }

    this.globalFrom = this.config.get<string>('SMTP_FROM') ?? 'no-reply@localhost';
    this.globalTransporter = this.buildSmtpTransporter({
      host,
      port: this.config.get<number>('SMTP_PORT', 587),
      user: this.config.get<string>('SMTP_USER'),
      pass: this.config.get<string>('SMTP_PASS'),
    });
  }

  async send(params: { tenantId: string; to: string[]; subject: string; html: string }): Promise<boolean> {
    if (params.to.length === 0) return false;

    const settings = await this.prisma.tenantEmailSettings.findUnique({ where: { tenantId: params.tenantId } });

    if (settings?.provider === 'MICROSOFT365' && settings.m365TenantId && settings.m365ClientId && settings.m365ClientSecretEncrypted && settings.m365SenderUpn) {
      const clientSecret = this.crypto.decrypt(settings.m365ClientSecretEncrypted);
      if (clientSecret) {
        return sendViaGraph(
          { tenantId: settings.m365TenantId, clientId: settings.m365ClientId, clientSecret, senderUpn: settings.m365SenderUpn },
          params,
        );
      }
      this.logger.error(`Microsoft 365 configurado para o tenant ${params.tenantId} mas o client secret não pôde ser decriptado.`);
    }

    const transporter = await this.resolveSmtpTransporter(params.tenantId, settings);
    if (!transporter) {
      this.logger.warn(`E-mail não enviado (nenhum provedor configurado para o tenant ${params.tenantId}): "${params.subject}"`);
      return false;
    }

    try {
      const from = settings?.provider === 'SMTP' && settings.smtpFrom ? settings.smtpFrom : this.globalFrom;
      await transporter.sendMail({ from, to: params.to, subject: params.subject, html: params.html });
      return true;
    } catch (error) {
      this.logger.error(`Falha ao enviar e-mail "${params.subject}": ${(error as Error).message}`);
      return false;
    }
  }

  private async resolveSmtpTransporter(
    tenantId: string,
    settings: { provider: string; smtpHost: string | null; smtpPort: number | null; smtpUser: string | null; smtpPasswordEncrypted: string | null } | null,
  ): Promise<Transporter | null> {
    if (settings?.provider === 'SMTP' && settings.smtpHost) {
      const cached = this.tenantTransporters.get(tenantId);
      if (cached) return cached;

      const pass = settings.smtpPasswordEncrypted ? (this.crypto.decrypt(settings.smtpPasswordEncrypted) ?? undefined) : undefined;
      const transporter = this.buildSmtpTransporter({
        host: settings.smtpHost,
        port: settings.smtpPort ?? 587,
        user: settings.smtpUser ?? undefined,
        pass,
      });
      this.tenantTransporters.set(tenantId, transporter);
      return transporter;
    }

    return this.globalTransporter;
  }

  private buildSmtpTransporter(opts: { host: string; port: number; user?: string; pass?: string }): Transporter {
    return nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.port === 465,
      auth: opts.user ? { user: opts.user, pass: opts.pass } : undefined,
    });
  }
}
