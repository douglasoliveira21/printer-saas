import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

export const PREVENTIVE_MAINTENANCE_QUEUE = 'preventive-maintenance';
export const RUN_PREVENTIVE_MAINTENANCE_JOB = 'run-preventive-maintenance';

/**
 * Once a day, for each PreventiveMaintenanceSchedule (Configurações >
 * Alertas > "Alertas de manutenção preventiva") whose nextDueAt has been
 * reached, auto-creates a ServiceOrder (serviceType: PREVENTIVE_MAINTENANCE
 * — an existing enum value, no schema change needed there) and advances
 * nextDueAt by intervalDays.
 */
@Processor(PREVENTIVE_MAINTENANCE_QUEUE)
export class PreventiveMaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(PreventiveMaintenanceProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== RUN_PREVENTIVE_MAINTENANCE_JOB) return;
    return this.run();
  }

  private async run() {
    const due = await this.prisma.preventiveMaintenanceSchedule.findMany({
      where: { active: true, nextDueAt: { lte: new Date() } },
      include: { printer: { select: { id: true, tenantId: true, customerId: true, locationId: true, number: true } } },
    });
    if (due.length === 0) {
      this.logger.log('Nenhuma manutenção preventiva vencida hoje.');
      return;
    }

    let created = 0;
    for (const schedule of due) {
      if (!schedule.printer.customerId) {
        // A ServiceOrder needs a customerId — a printer not yet claimed by a
        // customer can't have one opened automatically; skip and let the
        // schedule stay due until someone notices.
        this.logger.warn(`Manutenção preventiva ${schedule.id}: impressora ${schedule.printer.id} sem cliente vinculado, pulando.`);
        continue;
      }

      const last = await this.prisma.serviceOrder.findFirst({
        where: { tenantId: schedule.printer.tenantId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });

      await this.prisma.serviceOrder.create({
        data: {
          tenantId: schedule.printer.tenantId,
          number: (last?.number ?? 0) + 1,
          customerId: schedule.printer.customerId,
          locationId: schedule.printer.locationId,
          printerId: schedule.printer.id,
          serviceType: 'PREVENTIVE_MAINTENANCE',
          description: schedule.notes ?? 'Manutenção preventiva agendada automaticamente.',
          status: 'OPEN',
        },
      });

      const nextDueAt = new Date();
      nextDueAt.setDate(nextDueAt.getDate() + schedule.intervalDays);
      await this.prisma.preventiveMaintenanceSchedule.update({
        where: { id: schedule.id },
        data: { lastTriggeredAt: new Date(), nextDueAt },
      });
      created++;
    }

    this.logger.log(`Manutenção preventiva: ${created} chamado(s) criado(s).`);
  }
}
