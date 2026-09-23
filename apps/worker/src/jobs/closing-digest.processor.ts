import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';

// Own queue, not BILLING_QUEUE — two @Processor classes both bound to the
// same queue name would run as competing BullMQ workers that can pull each
// other's jobs off the queue and silently no-op them (job.name mismatch),
// not just log-and-skip like the intra-class switch pattern used elsewhere.
export const NOTIFICATIONS_QUEUE = 'notifications';
export const SEND_CLOSING_DIGEST_JOB = 'send-closing-digest';

/**
 * Once a day, e-mails each tenant's report recipients (ReportEmailRecipient)
 * a summary of the fechamentos (MonthlyClosing) belonging to contracts whose
 * billing cycle closed yesterday (billingDay === ontem) — spec: "os
 * fechamentos que encerraram no dia anterior, e foram congelados ou se
 * tornaram pendentes". Purely a status report: it does NOT auto-generate a
 * MonthlyClosing that doesn't exist yet — fechamentos are still generated
 * from the Financeiro UI; this job only reports on ones that already exist.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class ClosingDigestProcessor extends WorkerHost {
  private readonly logger = new Logger(ClosingDigestProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== SEND_CLOSING_DIGEST_JOB) {
      return;
    }
    return this.sendDigest();
  }

  private async sendDigest() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dayOfMonth = yesterday.getDate();
    const referenceYear = yesterday.getFullYear();
    const referenceMonth = yesterday.getMonth() + 1;

    const dueContracts = await this.prisma.contract.findMany({
      where: { status: 'ACTIVE', billingDay: dayOfMonth },
      select: { tenantId: true, customerId: true },
    });
    if (dueContracts.length === 0) {
      this.logger.log('Nenhum contrato com fechamento ontem — nada a resumir hoje.');
      return;
    }

    const uniqueCustomerIds = [...new Set(dueContracts.map((c) => c.customerId))];
    const closings = await this.prisma.monthlyClosing.findMany({
      where: { customerId: { in: uniqueCustomerIds }, referenceYear, referenceMonth },
      include: { customer: { select: { legalName: true, tradeName: true } } },
    });
    if (closings.length === 0) {
      this.logger.log('Contratos com fechamento ontem existem, mas nenhum MonthlyClosing foi gerado ainda — nada a resumir.');
      return;
    }

    const byTenant = new Map<string, typeof closings>();
    for (const closing of closings) {
      const list = byTenant.get(closing.tenantId) ?? [];
      list.push(closing);
      byTenant.set(closing.tenantId, list);
    }

    let sent = 0;
    for (const [tenantId, tenantClosings] of byTenant) {
      const recipients = await this.prisma.reportEmailRecipient.findMany({ where: { tenantId }, select: { email: true } });
      if (recipients.length === 0) {
        continue;
      }

      const rows = tenantClosings
        .map((c) => {
          const name = c.customer.tradeName || c.customer.legalName;
          const status = c.status === 'FROZEN' ? 'Congelado' : 'Pendente';
          const amount = Number(c.totalAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          return `<tr><td>${name}</td><td>${status}</td><td>${amount}</td></tr>`;
        })
        .join('');

      const html = `
        <h2>Resumo diário de fechamentos</h2>
        <p>Fechamentos referentes a ${String(referenceMonth).padStart(2, '0')}/${referenceYear} de contratos cujo dia de faturamento foi ontem.</p>
        <table border="1" cellpadding="6" cellspacing="0">
          <thead><tr><th>Cliente</th><th>Status</th><th>Valor</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      const ok = await this.mailer.send({
        to: recipients.map((r) => r.email),
        subject: 'Resumo diário de fechamentos',
        html,
      });
      if (ok) sent++;
    }

    this.logger.log(`Resumo diário de fechamentos: ${sent}/${byTenant.size} tenant(s) notificados.`);
  }
}
