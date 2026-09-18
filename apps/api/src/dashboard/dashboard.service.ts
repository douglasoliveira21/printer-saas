import { Injectable } from '@nestjs/common';
import { calculatePeriodUsage } from '@printer-saas/shared';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const PENDING_SERVICE_ORDER_STATUSES = ['OPEN', 'SCHEDULED', 'WAITING_PART', 'WAITING_CUSTOMER'] as const;

@Injectable()
export class DashboardService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async summary(customerId?: string) {
    const client = this.tenantPrisma.client;
    const printerScope = customerId ? { customerId } : {};
    const serviceOrderScope = customerId ? { customerId } : {};
    const alertScope = customerId ? { printer: { customerId } } : {};
    const replacementScope = customerId ? { printer: { customerId } } : {};

    const [
      customersTotal,
      printersDiscovered,
      printersMonitoredWithCustomer,
      printersMonitoredWithoutCustomer,
      printersOnlineSnmp,
      printersOfflineSnmp,
      printersManual,
      alertsCritical,
      alertsWarning,
      serviceOrdersPending,
      serviceOrdersInProgress,
      serviceOrdersDone,
      replacementsPending,
    ] = await Promise.all([
      customerId ? Promise.resolve(1) : client.customer.count(),
      client.printer.count({ where: { ...printerScope, status: 'DISCOVERED' } }),
      client.printer.count({ where: { ...printerScope, status: 'MONITORED', customerId: { not: null } } }),
      client.printer.count({ where: { ...printerScope, status: 'MONITORED', customerId: null } }),
      client.printer.count({ where: { ...printerScope, status: 'MONITORED', collectionMethod: 'SNMP', onlineStatus: 'ONLINE' } }),
      client.printer.count({ where: { ...printerScope, status: 'MONITORED', collectionMethod: 'SNMP', onlineStatus: 'OFFLINE' } }),
      client.printer.count({ where: { ...printerScope, status: 'MONITORED', collectionMethod: 'MANUAL' } }),
      client.alert.count({ where: { ...alertScope, status: 'OPEN', level: 'CRITICAL' } }),
      client.alert.count({ where: { ...alertScope, status: 'OPEN', level: 'WARNING' } }),
      client.serviceOrder.count({ where: { ...serviceOrderScope, status: { in: [...PENDING_SERVICE_ORDER_STATUSES] } } }),
      client.serviceOrder.count({ where: { ...serviceOrderScope, status: 'IN_PROGRESS' } }),
      client.serviceOrder.count({ where: { ...serviceOrderScope, status: 'DONE' } }),
      client.consumableReplacement.count({ where: { ...replacementScope, status: 'PREDICTED' } }),
    ]);

    const printersOrigin = { clientes: printersMonitoredWithCustomer, empresa: printersMonitoredWithoutCustomer, novas: printersDiscovered };
    const printersCommunication = { ok: printersOnlineSnmp, falha: printersOfflineSnmp, manual: printersManual };

    return {
      customers: { total: customersTotal },
      printers: {
        total: printersDiscovered + printersMonitoredWithCustomer + printersMonitoredWithoutCustomer,
        origin: printersOrigin,
        communication: printersCommunication,
      },
      alerts: { total: alertsCritical + alertsWarning, alto: alertsCritical, medio: alertsWarning },
      serviceOrders: {
        total: serviceOrdersPending + serviceOrdersInProgress + serviceOrdersDone,
        pendente: serviceOrdersPending,
        andamento: serviceOrdersInProgress,
        finalizado: serviceOrdersDone,
      },
      replacementsPending,
    };
  }

  /** Sums P&B/color/copies usage per period across every printer (optionally scoped to one customer). */
  async pageUsage(granularity: 'month' | 'day', customerId?: string) {
    const now = new Date();
    const periods = granularity === 'month' ? buildMonthPeriods(now, 6) : buildDayPeriods(now, 30);

    const printers = await this.tenantPrisma.client.printer.findMany({
      where: customerId ? { customerId } : {},
      select: {
        id: true,
        counters: {
          where: { collectedAt: { lte: periods[periods.length - 1].to } },
          orderBy: { collectedAt: 'asc' },
          select: { collectedAt: true, total: true, blackWhite: true, color: true, copies: true },
        },
      },
    });

    return periods.map(({ label, from, to }) => {
      let blackWhite = 0;
      let color = 0;
      let copies = 0;
      for (const printer of printers) {
        blackWhite += calculatePeriodUsage(printer.counters, 'blackWhite', from, to).pagesUsed ?? 0;
        color += calculatePeriodUsage(printer.counters, 'color', from, to).pagesUsed ?? 0;
        copies += calculatePeriodUsage(printer.counters, 'copies', from, to).pagesUsed ?? 0;
      }
      return { period: label, blackWhite, color, copies };
    });
  }

  /** Top 5 customers by total page usage over the last 30 days, remainder bucketed as "Outros". */
  async topCustomersByUsage(customerId?: string) {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const printers = await this.tenantPrisma.client.printer.findMany({
      where: { customerId: customerId ?? { not: null } },
      select: {
        customer: { select: { id: true, legalName: true, tradeName: true } },
        counters: {
          where: { collectedAt: { gte: from, lte: to } },
          orderBy: { collectedAt: 'asc' },
          select: { collectedAt: true, total: true, blackWhite: true, color: true, copies: true },
        },
      },
    });

    const usageByCustomer = new Map<string, { name: string; pages: number }>();
    for (const printer of printers) {
      if (!printer.customer) continue;
      const usage = calculatePeriodUsage(printer.counters, 'total', from, to).pagesUsed ?? 0;
      const existing = usageByCustomer.get(printer.customer.id);
      const name = printer.customer.tradeName || printer.customer.legalName;
      usageByCustomer.set(printer.customer.id, { name, pages: (existing?.pages ?? 0) + usage });
    }

    const sorted = Array.from(usageByCustomer.values())
      .filter((c) => c.pages > 0)
      .sort((a, b) => b.pages - a.pages);

    const top = sorted.slice(0, 5);
    const rest = sorted.slice(5).reduce((sum, c) => sum + c.pages, 0);
    return rest > 0 ? [...top, { name: 'Outros', pages: rest }] : top;
  }
}

function buildMonthPeriods(now: Date, count: number) {
  const periods: { label: string; from: Date; to: Date }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    periods.push({ label: from.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), from, to });
  }
  return periods;
}

function buildDayPeriods(now: Date, count: number) {
  const periods: { label: string; from: Date; to: Date }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1);
    periods.push({ label: from.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), from, to });
  }
  return periods;
}
