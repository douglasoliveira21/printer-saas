import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Thin wrapper over nodemailer's generic SMTP transport — works with any
 * provider (Gmail SMTP, SendGrid, SES, Mailgun, ...) via
 * SMTP_HOST/PORT/USER/PASS/FROM env vars. If SMTP_HOST isn't configured yet
 * (fresh install, credentials not set up in production), send() logs a
 * warning and no-ops instead of throwing — a missing mail provider must
 * never crash the worker's daily scheduler.
 */
@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null = null;
  private from = 'no-reply@localhost';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) {
      this.logger.warn('SMTP_HOST não configurado — envio de e-mail desabilitado (resumos diários de fechamento não serão enviados).');
      return;
    }

    this.from = this.config.get<string>('SMTP_FROM') ?? 'no-reply@localhost';
    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT', 587),
      secure: this.config.get<number>('SMTP_PORT', 587) === 465,
      auth: this.config.get<string>('SMTP_USER')
        ? { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASS') }
        : undefined,
    });
  }

  async send(params: { to: string[]; subject: string; html: string }): Promise<boolean> {
    if (!this.transporter || params.to.length === 0) {
      if (!this.transporter) {
        this.logger.warn(`E-mail não enviado (SMTP não configurado): "${params.subject}" para ${params.to.join(', ')}`);
      }
      return false;
    }

    try {
      await this.transporter.sendMail({ from: this.from, to: params.to, subject: params.subject, html: params.html });
      return true;
    } catch (error) {
      this.logger.error(`Falha ao enviar e-mail "${params.subject}": ${(error as Error).message}`);
      return false;
    }
  }
}
