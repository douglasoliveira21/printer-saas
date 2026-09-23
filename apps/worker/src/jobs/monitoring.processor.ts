import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { isNotificationEnabledForCustomer } from '../notifications/notification-gate';

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
    private readonly mailer: MailerService,
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
    // Global defaults (seconds) — used for any tenant that hasn't set its
    // own threshold in Configurações > Alertas > "Alertas de falha na
    // comunicação" (Tenant.agentOfflineThresholdHours/printerOfflineThresholdHours).
    const defaultAgentThresholdSeconds = this.config.get<number>('AGENT_OFFLINE_THRESHOLD_SECONDS', 120);
    const defaultPrinterThresholdSeconds = this.config.get<number>('PRINTER_OFFLINE_THRESHOLD_SECONDS', 2400);

    const tenantThresholds = new Map(
      (await this.prisma.tenant.findMany({ select: { id: true, agentOfflineThresholdHours: true, printerOfflineThresholdHours: true } })).map(
        (t) => [t.id, t],
      ),
    );

    // SQL filter uses the (stricter, shorter) global default as the widest
    // possible net, then each row is checked against its own tenant's actual
    // threshold in JS below — a custom threshold can only be MORE tolerant
    // than the default (Configurações > Alertas enforces a minimum of 1h,
    // already well above either default), never stricter, so the default
    // cutoff never excludes a row that could still qualify for some tenant.
    // Per-tenant SQL cutoffs would need one query per tenant — not worth it
    // at this scale.
    const now = Date.now();
    const agentWideCutoff = new Date(now - defaultAgentThresholdSeconds * 1000);
    const printerWideCutoff = new Date(now - defaultPrinterThresholdSeconds * 1000);

    const candidateAgents = await this.prisma.agent.findMany({ where: { status: 'ONLINE', lastHeartbeatAt: { lt: agentWideCutoff } } });
    let agentsMarkedOffline = 0;
    for (const agent of candidateAgents) {
      const thresholdSeconds = tenantThresholds.get(agent.tenantId)?.agentOfflineThresholdHours
        ? tenantThresholds.get(agent.tenantId)!.agentOfflineThresholdHours! * 3600
        : defaultAgentThresholdSeconds;
      if (now - agent.lastHeartbeatAt!.getTime() < thresholdSeconds * 1000) continue;

      await this.prisma.agent.update({ where: { id: agent.id }, data: { status: 'OFFLINE' } });
      await this.prisma.alert.create({
        data: {
          tenantId: agent.tenantId,
          type: 'AGENT_OFFLINE',
          level: 'WARNING',
          message: `Agent "${agent.name}" está offline (sem heartbeat há mais de ${thresholdSeconds}s).`,
        },
      });
      agentsMarkedOffline++;
    }

    const candidatePrinters = await this.prisma.printer.findMany({
      where: { status: 'MONITORED', onlineStatus: 'ONLINE', lastSeenAt: { lt: printerWideCutoff } },
      include: { contractPrinters: { select: { monitoringDisabled: true } } },
    });
    let printersMarkedOffline = 0;
    for (const printer of candidatePrinters) {
      // "Desabilitar manualmente o monitoramento das impressoras nos
      // contratos" (Configurações > Informações da empresa) — skip entirely
      // if any contract line for this printer has it disabled.
      if (printer.contractPrinters.some((cp) => cp.monitoringDisabled)) continue;

      const thresholdSeconds = tenantThresholds.get(printer.tenantId)?.printerOfflineThresholdHours
        ? tenantThresholds.get(printer.tenantId)!.printerOfflineThresholdHours! * 3600
        : defaultPrinterThresholdSeconds;
      if (now - printer.lastSeenAt!.getTime() < thresholdSeconds * 1000) continue;

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
      printersMarkedOffline++;
    }

    this.logger.log(`Offline check: ${agentsMarkedOffline} agents, ${printersMarkedOffline} printers marked offline`);
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
      select: { id: true, tenantId: true, number: true, slaDueAt: true, technicianId: true, customerId: true },
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

      // Same dedup as the Alert above (one per order/type while it stays
      // OPEN) — otherwise this job (runs every 5min) would re-send the
      // e-mail every run for the same still-breaching ticket.
      if (order.technicianId) {
        await this.notifyTechnicianSla(order.tenantId, order.customerId, order.technicianId, order.number, isLate);
      }
    }

    this.logger.log(`SLA check: ${alertsCreated} alerts created`);
  }

  private async notifyTechnicianSla(tenantId: string, customerId: string | null, technicianId: string, orderNumber: number, isLate: boolean) {
    const type = isLate ? 'TICKET_SLA_BREACHED' : 'TICKET_SLA_EXPIRING';
    if (!(await isNotificationEnabledForCustomer(this.prisma, tenantId, type, customerId))) return;

    const prefField = isLate ? 'notifyTicketSlaBreached' : 'notifyTicketSlaExpiring';
    const technician = await this.prisma.user.findFirst({
      where: { id: technicianId, deletedAt: null, [prefField]: true },
      select: { email: true, name: true },
    });
    if (!technician) return;

    await this.mailer.send({
      tenantId,
      to: [technician.email],
      subject: isLate ? `Chamado #${orderNumber} com SLA vencido` : `Chamado #${orderNumber} perto do prazo de SLA`,
      html: isLate
        ? `<p>Olá ${technician.name},</p><p>O chamado <strong>#${orderNumber}</strong>, do qual você é responsável, está com o SLA vencido.</p>`
        : `<p>Olá ${technician.name},</p><p>O chamado <strong>#${orderNumber}</strong>, do qual você é responsável, vence o SLA em menos de 2 horas.</p>`,
    });
  }
}
