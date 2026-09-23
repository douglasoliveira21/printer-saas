import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { calculatePeriodUsage } from '@printer-saas/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';

// Own queue — see the comment on NOTIFICATIONS_QUEUE in closing-digest.processor.ts
// for why a job type never shares a queue with a different @Processor class.
export const REPORTS_QUEUE = 'reports';
export const SEND_REPORT_DELIVERIES_JOB = 'send-report-deliveries';

const EMAIL_FIELD_TO_COLUMN = { EMAIL: 'email', FINANCIAL_EMAIL: 'financialEmail', SUPPORT_EMAIL: 'supportEmail' } as const;

/**
 * Once a day, for each tenant's configured ReportDelivery rows
 * (Configurações > E-mail > Envio de relatórios), e-mails the relevant
 * report to the target customer(s) using whichever of their registered
 * addresses (email/financialEmail/supportEmail) was picked — never a
 * free-typed address. Covers the previous calendar day as the period.
 */
@Processor(REPORTS_QUEUE)
export class ReportDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== SEND_REPORT_DELIVERIES_JOB) return;
    return this.sendAll();
  }

  private async sendAll() {
    const deliveries = await this.prisma.reportDelivery.findMany({
      include: { customers: { select: { customerId: true } } },
    });
    if (deliveries.length === 0) {
      this.logger.log('Nenhum envio de relatório configurado.');
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const from = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const to = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1);

    let sent = 0;
    for (const delivery of deliveries) {
      const customers = await this.prisma.customer.findMany({
        where: delivery.allCustomers
          ? { tenantId: delivery.tenantId }
          : { tenantId: delivery.tenantId, id: { in: delivery.customers.map((c) => c.customerId) } },
        select: { id: true, legalName: true, tradeName: true, email: true, financialEmail: true, supportEmail: true },
      });

      for (const customer of customers) {
        const emailColumn = EMAIL_FIELD_TO_COLUMN[delivery.emailField];
        const to_ = customer[emailColumn];
        if (!to_) continue;

        const html = await this.buildReportHtml(delivery.reportType, delivery.tenantId, customer.id, from, to);
        if (!html) continue;

        const ok = await this.mailer.send({ tenantId: delivery.tenantId, to: [to_], subject: this.subjectFor(delivery.reportType), html });
        if (ok) sent++;
      }
    }

    this.logger.log(`Envio de relatórios: ${sent} e-mail(s) enviados.`);
  }

  private subjectFor(reportType: string) {
    return {
      PRINTER_USAGE: 'Digitação por impressora',
      CLOSING_DIGEST: 'Resumo diário de fechamentos',
      PRINTER_USAGE_WITH_COPIES: 'Digitação e cópias por impressora',
    }[reportType]!;
  }

  private async buildReportHtml(reportType: string, tenantId: string, customerId: string, from: Date, to: Date): Promise<string | null> {
    if (reportType === 'CLOSING_DIGEST') {
      return this.buildClosingDigestHtml(tenantId, customerId);
    }
    const settings = await this.prisma.tenantClosingSettings.findUnique({ where: { tenantId } });
    const columns = (settings?.printUsageReportColumns as Record<string, boolean> | undefined) ?? {};
    return this.buildPrinterUsageHtml(customerId, from, to, reportType === 'PRINTER_USAGE_WITH_COPIES', columns);
  }

  private async buildClosingDigestHtml(tenantId: string, customerId: string): Promise<string | null> {
    const now = new Date();
    const closing = await this.prisma.monthlyClosing.findFirst({
      where: { tenantId, customerId, referenceYear: now.getFullYear(), referenceMonth: now.getMonth() + 1 },
    });
    if (!closing) return null;

    const status = closing.status === 'FROZEN' ? 'Congelado' : 'Pendente';
    const amount = Number(closing.totalAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return `<h2>Resumo diário de fechamentos</h2><p>Status: ${status}</p><p>Valor: ${amount}</p>`;
  }

  private async buildPrinterUsageHtml(
    customerId: string,
    from: Date,
    to: Date,
    withCopies: boolean,
    columns: Record<string, boolean>,
  ): Promise<string | null> {
    const printers = await this.prisma.printer.findMany({
      where: { customerId, status: 'MONITORED' },
      include: {
        counters: { where: { collectedAt: { gte: from, lte: to } }, orderBy: { collectedAt: 'asc' } },
        location: { select: { name: true } },
        department: { select: { name: true } },
      },
    });
    if (printers.length === 0) return null;

    // Só as chaves com dado real hoje têm efeito — ver TenantClosingSettings no schema.
    const showSerial = columns.printer_id_serial;
    const showIp = columns.printer_id_ip;
    const showMac = columns.printer_id_mac;
    const showLocation = columns.printer_id_location;
    const showDepartment = columns.printer_id_department;

    const rows = printers
      .map((printer) => {
        const total = calculatePeriodUsage(printer.counters, 'total', from, to);
        const bw = calculatePeriodUsage(printer.counters, 'blackWhite', from, to);
        const color = calculatePeriodUsage(printer.counters, 'color', from, to);
        const copies = withCopies ? calculatePeriodUsage(printer.counters, 'copies', from, to) : null;
        const label = `${printer.manufacturer ?? ''} ${printer.model ?? ''}`.trim() || printer.id;
        const idCells =
          (showSerial ? `<td>${printer.serial ?? '—'}</td>` : '') +
          (showIp ? `<td>${printer.ip ?? '—'}</td>` : '') +
          (showMac ? `<td>${printer.mac ?? '—'}</td>` : '') +
          (showLocation ? `<td>${printer.location?.name ?? '—'}</td>` : '') +
          (showDepartment ? `<td>${printer.department?.name ?? '—'}</td>` : '');
        return `<tr><td>${label}</td>${idCells}<td>${total.pagesUsed ?? '—'}</td><td>${bw.pagesUsed ?? '—'}</td><td>${color.pagesUsed ?? '—'}</td>${withCopies ? `<td>${copies!.pagesUsed ?? '—'}</td>` : ''}</tr>`;
      })
      .join('');

    const idHeaders =
      (showSerial ? '<th>Série</th>' : '') +
      (showIp ? '<th>IP</th>' : '') +
      (showMac ? '<th>MAC</th>' : '') +
      (showLocation ? '<th>Local</th>' : '') +
      (showDepartment ? '<th>Depto</th>' : '');

    return `
      <h2>${withCopies ? 'Digitação e cópias por impressora' : 'Digitação por impressora'}</h2>
      <table border="1" cellpadding="6" cellspacing="0">
        <thead><tr><th>Impressora</th>${idHeaders}<th>Total</th><th>P&B</th><th>Colorida</th>${withCopies ? '<th>Cópias</th>' : ''}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }
}
