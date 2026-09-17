import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { calculateFranchiseBilling, calculatePeriodUsage } from '@printer-saas/shared';
import { PrismaService } from '../prisma/prisma.service';

export const BILLING_QUEUE = 'billing';
export const GENERATE_MONTHLY_CHARGES_JOB = 'generate-monthly-charges';

/**
 * Generates a `FinancialEntry` (contas a receber) for each active contract
 * whose `billingDay` is today, computing franchise overage from the linked
 * printer's real counter history (spec §29-30). Runs once a day; idempotent
 * per (contract, month) so a retry or an extra trigger never double-bills.
 */
@Processor(BILLING_QUEUE)
export class BillingProcessor extends WorkerHost {
  private readonly logger = new Logger(BillingProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== GENERATE_MONTHLY_CHARGES_JOB) {
      this.logger.warn(`Unknown job: ${job.name}`);
      return;
    }
    return this.generateMonthlyCharges();
  }

  private async generateMonthlyCharges() {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const periodFrom = new Date(today.getFullYear(), today.getMonth() - 1, dayOfMonth);
    const periodTo = today;

    const dueContracts = await this.prisma.contract.findMany({
      where: {
        status: 'ACTIVE',
        billingDay: dayOfMonth,
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
    });

    let created = 0;
    let skippedExisting = 0;
    let skippedNoData = 0;

    for (const contract of dueContracts) {
      const alreadyBilled = await this.prisma.financialEntry.findFirst({
        where: {
          contractId: contract.id,
          dueDate: { gte: new Date(today.getFullYear(), today.getMonth(), 1) },
        },
      });
      if (alreadyBilled) {
        skippedExisting++;
        continue;
      }

      let amount = Number(contract.monthlyFee);
      let description = `Mensalidade contrato #${contract.number}`;

      if (contract.printerId) {
        const readings = await this.prisma.counterReading.findMany({
          where: { printerId: contract.printerId, collectedAt: { gte: periodFrom, lte: periodTo } },
          orderBy: { collectedAt: 'asc' },
        });
        const usage = calculatePeriodUsage(readings, 'total', periodFrom, periodTo);

        if (usage.pagesUsed === null) {
          // Never invent a bill component: without enough counter data we
          // charge the flat monthly fee only, and flag it in the
          // description so a human can review/adjust rather than silently
          // under- or over-charging.
          skippedNoData++;
          description += ' (franquia não calculada — dados de contador insuficientes no período)';
        } else {
          const billing = calculateFranchiseBilling({
            franchisePages: contract.franchisePages,
            monthlyFee: Number(contract.monthlyFee),
            overagePricePerPage: Number(contract.overagePriceBw),
            usage,
          });
          amount = billing.totalAmount ?? amount;
          if ((billing.overturnedPages ?? 0) > 0) {
            description += ` + excedente ${billing.overturnedPages} páginas`;
          }
        }
      }

      await this.prisma.financialEntry.create({
        data: {
          tenantId: contract.tenantId,
          type: 'RECEIVABLE',
          category: 'Mensalidade',
          description,
          amount,
          dueDate: today,
          customerId: contract.customerId,
          contractId: contract.id,
        },
      });
      created++;
    }

    this.logger.log(
      `Monthly billing: ${created} entries created, ${skippedExisting} already billed, ${skippedNoData} without enough counter data`,
    );
  }
}
