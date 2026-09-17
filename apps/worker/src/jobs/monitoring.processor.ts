import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

export const MONITORING_QUEUE = 'monitoring';
export const CHECK_OFFLINE_JOB = 'check-offline';
export const CHECK_TONER_JOB = 'check-toner';
export const CHECK_SLA_JOB = 'check-sla';

const TONER_WARNING_THRESHOLD = 20;
const TONER_CRITICAL_THRESHOLD = 10;
const SLA_EXPIRING_WARNING_MS = 2 * 60 * 60 * 1000; // warn once an OS is within 2h of breaching its SLA
const OPEN_SERVICE_ORDER_STATUSES = ['OPEN', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_PART', 'WAITING_CUSTOMER'] as const;

@Processor(MONITORING_QUEUE)
export class MonitoringProcessor extends WorkerHost {
  private readonly logger = new Logger(MonitoringProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case CHECK_OFFLINE_JOB:
        return this.checkOffline();
      case CHECK_TONER_JOB:
        return this.checkToner();
      case CHECK_SLA_JOB:
        return this.checkServiceOrderSla();
      default:
        this.logger.warn(`Unknown job: ${job.name}`);
    }
  }

  private async checkOffline() {
    // Agent staleness is based on heartbeat, which the Agent sends every ~30s
    // regardless of its SNMP collection cadence, so a short threshold is safe.
    const agentThresholdSeconds = this.config.get<number>('AGENT_OFFLINE_THRESHOLD_SECONDS', 120);
    const agentCutoff = new Date(Date.now() - agentThresholdSeconds * 1000);

    // Printer staleness is based on lastSeenAt, which only advances once per
    // SNMP collection cycle (CollectionIntervalSeconds, default 900s/15min).
    // Reusing the short agent threshold here false-flagged healthy printers
    // as offline between collection cycles, so this needs its own, longer
    // default that tolerates at least one missed cycle.
    const printerThresholdSeconds = this.config.get<number>('PRINTER_OFFLINE_THRESHOLD_SECONDS', 2400);
    const printerCutoff = new Date(Date.now() - printerThresholdSeconds * 1000);

    const staleAgents = await this.prisma.agent.findMany({
      where: { status: 'ONLINE', lastHeartbeatAt: { lt: agentCutoff } },
    });

    for (const agent of staleAgents) {
      await this.prisma.agent.update({ where: { id: agent.id }, data: { status: 'OFFLINE' } });
      await this.prisma.alert.create({
        data: {
          tenantId: agent.tenantId,
          type: 'AGENT_OFFLINE',
          level: 'WARNING',
          message: `Agent "${agent.name}" está offline (sem heartbeat há mais de ${agentThresholdSeconds}s).`,
        },
      });
    }

    const stalePrinters = await this.prisma.printer.findMany({
      where: { status: 'MONITORED', onlineStatus: 'ONLINE', lastSeenAt: { lt: printerCutoff } },
    });

    for (const printer of stalePrinters) {
      await this.prisma.printer.update({ where: { id: printer.id }, data: { onlineStatus: 'OFFLINE' } });
      await this.prisma.alert.create({
        data: {
          tenantId: printer.tenantId,
          printerId: printer.id,
          type: 'PRINTER_OFFLINE',
          level: 'WARNING',
          message: `Impressora ${printer.model ?? printer.ip ?? printer.id} está offline.`,
        },
      });
    }

    this.logger.log(`Offline check: ${staleAgents.length} agents, ${stalePrinters.length} printers marked offline`);
  }

  private async checkToner() {
    // Latest reading per (printer, type, color) — cheap enough at MVP scale;
    // revisit with a materialized "current consumable state" table if this
    // becomes a bottleneck.
    const printers = await this.prisma.printer.findMany({
      where: { status: 'MONITORED' },
      select: { id: true, tenantId: true, model: true, ip: true },
    });

    let alertsCreated = 0;
    for (const printer of printers) {
      const latestByKey = new Map<string, { levelPercent: number | null; color: string | null }>();
      const readings = await this.prisma.consumableReading.findMany({
        where: { printerId: printer.id, type: 'toner' },
        orderBy: { collectedAt: 'desc' },
        take: 20,
      });

      for (const reading of readings) {
        const key = `${reading.color ?? 'default'}`;
        if (!latestByKey.has(key)) {
          latestByKey.set(key, { levelPercent: reading.levelPercent, color: reading.color });
        }
      }

      for (const { levelPercent, color } of latestByKey.values()) {
        if (levelPercent === null || levelPercent === undefined) continue;

        const existingOpenAlert = await this.prisma.alert.findFirst({
          where: {
            printerId: printer.id,
            type: { in: ['TONER_LOW', 'TONER_CRITICAL'] },
            status: 'OPEN',
            metadata: { path: ['color'], equals: color ?? 'default' },
          },
        });

        if (levelPercent <= TONER_CRITICAL_THRESHOLD) {
          if (!existingOpenAlert || existingOpenAlert.type !== 'TONER_CRITICAL') {
            if (existingOpenAlert) {
              await this.prisma.alert.update({ where: { id: existingOpenAlert.id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
            }
            await this.prisma.alert.create({
              data: {
                tenantId: printer.tenantId,
                printerId: printer.id,
                type: 'TONER_CRITICAL',
                level: 'CRITICAL',
                message: `Toner ${color ?? ''} crítico (${levelPercent}%) na impressora ${printer.model ?? printer.ip ?? printer.id}.`,
                metadata: { color: color ?? 'default', levelPercent },
              },
            });
            alertsCreated++;
          }
        } else if (levelPercent <= TONER_WARNING_THRESHOLD) {
          if (!existingOpenAlert) {
            await this.prisma.alert.create({
              data: {
                tenantId: printer.tenantId,
                printerId: printer.id,
                type: 'TONER_LOW',
                level: 'WARNING',
                message: `Toner ${color ?? ''} baixo (${levelPercent}%) na impressora ${printer.model ?? printer.ip ?? printer.id}.`,
                metadata: { color: color ?? 'default', levelPercent },
              },
            });
            alertsCreated++;
          }
        }
      }
    }

    this.logger.log(`Toner check: ${alertsCreated} alerts created`);
  }

  private async checkServiceOrderSla() {
    const now = Date.now();
    const orders = await this.prisma.serviceOrder.findMany({
      where: { slaDueAt: { not: null }, status: { in: [...OPEN_SERVICE_ORDER_STATUSES] } },
      select: { id: true, tenantId: true, number: true, slaDueAt: true },
    });

    let alertsCreated = 0;
    for (const order of orders) {
      const dueAt = order.slaDueAt!.getTime();
      const isLate = dueAt < now;
      const isExpiringSoon = !isLate && dueAt - now <= SLA_EXPIRING_WARNING_MS;
      if (!isLate && !isExpiringSoon) continue;

      const type = isLate ? 'SERVICE_ORDER_LATE' : 'SLA_EXPIRING';
      const existingOpenAlert = await this.prisma.alert.findFirst({
        where: { serviceOrderId: order.id, type, status: 'OPEN' },
      });
      if (existingOpenAlert) continue;

      await this.prisma.alert.create({
        data: {
          tenantId: order.tenantId,
          serviceOrderId: order.id,
          type,
          level: isLate ? 'CRITICAL' : 'WARNING',
          message: isLate
            ? `OS #${order.number} está com o SLA vencido.`
            : `OS #${order.number} vence o SLA em menos de 2 horas.`,
        },
      });
      alertsCreated++;
    }

    this.logger.log(`SLA check: ${alertsCreated} alerts created`);
  }
}
