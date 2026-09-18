import { Injectable, NotFoundException } from '@nestjs/common';
import { calculatePeriodUsage, calculateSupplyForecast, type CounterPoint } from '@printer-saas/shared';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { paginated } from '../common/dto/pagination.dto';
import type { ListPrintersQueryDto } from './dto/list-printers-query.dto';
import type { ClaimPrinterDto } from './dto/claim-printer.dto';
import type { UpdatePrinterDto } from './dto/update-printer.dto';

@Injectable()
export class PrintersService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly dashboardService: DashboardService,
  ) {}

  async findAll(query: ListPrintersQueryDto) {
    const where = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.search
        ? {
            OR: [
              { ip: { contains: query.search, mode: 'insensitive' as const } },
              { serial: { contains: query.search, mode: 'insensitive' as const } },
              { hostname: { contains: query.search, mode: 'insensitive' as const } },
              { model: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.printer.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { lastSeenAt: 'desc' },
        include: { customer: true, location: true, agent: { select: { id: true, name: true } } },
      }),
      this.tenantPrisma.client.printer.count({ where }),
    ]);

    return paginated(data, total, query);
  }

  async findOne(id: string) {
    const printer = await this.tenantPrisma.client.printer.findFirst({
      where: { id },
      include: {
        customer: true,
        location: true,
        agent: { select: { id: true, name: true, status: true, hostname: true } },
        counters: { orderBy: { collectedAt: 'desc' }, take: 50 },
        consumables: { orderBy: { collectedAt: 'desc' }, take: 50 },
      },
    });
    if (!printer) {
      throw new NotFoundException('Impressora não encontrada');
    }

    // Every fetched reading of a given type+color (not just the latest), so
    // both the forecast trend and the replacement-cycle stats below have
    // real data points to work with.
    const readingsByKey = new Map<string, { levelPercent: number | null; collectedAt: Date }[]>();
    for (const c of printer.consumables) {
      const key = `${c.type}:${c.color ?? 'default'}`;
      const list = readingsByKey.get(key) ?? [];
      list.push({ levelPercent: c.levelPercent, collectedAt: c.collectedAt });
      readingsByKey.set(key, list);
    }

    const replacements = await this.tenantPrisma.client.consumableReplacement.findMany({
      where: { printerId: id, replacedAt: { not: null } },
      orderBy: { replacedAt: 'asc' },
    });
    const replacementsByKey = new Map<string, typeof replacements>();
    for (const r of replacements) {
      const key = `${r.type}:${r.color ?? 'default'}`;
      const list = replacementsByKey.get(key) ?? [];
      list.push(r);
      replacementsByKey.set(key, list);
    }

    const consumablesWithForecast = printer.consumables.map((c) => {
      const key = `${c.type}:${c.color ?? 'default'}`;
      return {
        ...c,
        forecast: calculateSupplyForecast(readingsByKey.get(key) ?? []),
        stats: computeSupplyStats(printer.counters, replacementsByKey.get(key) ?? [], printer.createdAt, c.levelPercent),
      };
    });

    return { ...printer, consumables: consumablesWithForecast };
  }

  /** Merges supply replacements and service orders into one chronological feed (spec: "linha do tempo de suprimentos e peças"). */
  async timeline(id: string) {
    await this.findOne(id);
    const [replacements, serviceOrders] = await Promise.all([
      this.tenantPrisma.client.consumableReplacement.findMany({ where: { printerId: id }, orderBy: { createdAt: 'desc' } }),
      this.tenantPrisma.client.serviceOrder.findMany({ where: { printerId: id }, orderBy: { createdAt: 'desc' } }),
    ]);

    const items = [
      ...replacements.map((r) => ({
        type: 'replacement' as const,
        date: r.replacedAt ?? r.createdAt,
        status: r.status,
        label: `${r.type}${r.color ? ` (${r.color})` : ''}`,
        notes: r.notes,
      })),
      ...serviceOrders.map((o) => ({
        type: 'service_order' as const,
        date: o.completedAt ?? o.createdAt,
        status: o.status,
        label: `OS #${o.number}${o.type ? ` — ${o.type}` : ''}`,
        notes: o.description,
      })),
    ];

    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  pageUsage(id: string, granularity: 'month' | 'day') {
    return this.dashboardService.pageUsage(granularity, { printerId: id });
  }

  async listComments(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.printerComment.findMany({
      where: { printerId: id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async createComment(id: string, userId: string | undefined, body: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.printerComment.create({
      // tenantId is injected at runtime by the tenant-scoped Prisma extension.
      data: { printerId: id, userId, body } as any,
      include: { user: { select: { id: true, name: true } } },
    });
  }

  /** Moves a DISCOVERED printer into MONITORED and links it to a customer/location (see spec §23). */
  async claim(id: string, dto: ClaimPrinterDto) {
    await this.findOne(id);
    const customer = await this.tenantPrisma.client.customer.findFirst({ where: { id: dto.customerId } });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    if (dto.locationId) {
      const location = await this.tenantPrisma.client.location.findFirst({
        where: { id: dto.locationId, customerId: dto.customerId },
      });
      if (!location) {
        throw new NotFoundException('Local não encontrado para este cliente');
      }
    }

    return this.tenantPrisma.client.printer.update({
      where: { id },
      data: { customerId: dto.customerId, locationId: dto.locationId, status: 'MONITORED', monitoredAt: new Date() },
    });
  }

  async ignore(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.printer.update({ where: { id }, data: { status: 'IGNORED' } });
  }

  /** Un-ignores / un-decommissions a printer back to DISCOVERED, so it can be claimed again. */
  async restore(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.printer.update({ where: { id }, data: { status: 'DISCOVERED' } });
  }

  /** Retires equipment that's been physically removed/replaced (spec §70) — history stays, just stops appearing as active. */
  async decommission(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.printer.update({ where: { id }, data: { status: 'DECOMMISSIONED' } });
  }

  /** Manual correction of vendor-reported fields (spec §18: not every device reports these accurately), plus SLA override. */
  async update(id: string, dto: UpdatePrinterDto) {
    await this.findOne(id);
    return this.tenantPrisma.client.printer.update({ where: { id }, data: dto });
  }
}

interface ReplacementRecord {
  replacedAt: Date | null;
}

/**
 * Derives per-supply stats purely from data we actually have: counter
 * history + confirmed replacement dates. `estimatedCoveragePercent` is
 * exactly that — an estimate (toner % consumed per page since install), not
 * a real ink-density measurement, since SNMP doesn't expose page coverage.
 */
function computeSupplyStats(
  counters: CounterPoint[],
  replacements: ReplacementRecord[],
  printerCreatedAt: Date,
  currentLevelPercent: number | null,
) {
  const boundaries = [printerCreatedAt, ...replacements.map((r) => r.replacedAt).filter((d): d is Date => d !== null)];
  const installedAt = boundaries[boundaries.length - 1];
  const now = new Date();

  const pagesPrintedSinceInstall = calculatePeriodUsage(counters, 'total', installedAt, now).pagesUsed;

  let cycleDaysTotal = 0;
  let cyclePagesTotal = 0;
  let cycles = 0;
  for (let i = 1; i < boundaries.length; i++) {
    const from = boundaries[i - 1];
    const to = boundaries[i];
    const pages = calculatePeriodUsage(counters, 'total', from, to).pagesUsed;
    if (pages === null) continue;
    cycleDaysTotal += (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
    cyclePagesTotal += pages;
    cycles++;
  }

  const estimatedCoveragePercent =
    pagesPrintedSinceInstall && pagesPrintedSinceInstall > 0 && currentLevelPercent !== null
      ? Math.round(((100 - currentLevelPercent) / pagesPrintedSinceInstall) * 10000) / 10000
      : null;

  return {
    pagesPrintedSinceInstall,
    averagePagesPerReplacement: cycles > 0 ? Math.round(cyclePagesTotal / cycles) : null,
    averageDaysBetweenReplacements: cycles > 0 ? Math.round(cycleDaysTotal / cycles) : null,
    estimatedCoveragePercent,
  };
}
