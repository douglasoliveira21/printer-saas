import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PaginationDto, paginated } from '../common/dto/pagination.dto';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';
import type { SetWorkingHoursDto } from './dto/set-working-hours.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  create(dto: CreateCustomerDto) {
    // tenantId is injected at runtime by the tenant-scoped Prisma extension.
    return this.tenantPrisma.client.customer.create({ data: dto as any });
  }

  async findAll(pagination: PaginationDto) {
    const where = pagination.search
      ? {
          OR: [
            { legalName: { contains: pagination.search, mode: 'insensitive' as const } },
            { tradeName: { contains: pagination.search, mode: 'insensitive' as const } },
            { document: { contains: pagination.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.customer.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { legalName: 'asc' },
      }),
      this.tenantPrisma.client.customer.count({ where }),
    ]);

    if (data.length === 0) {
      return paginated(data, total, pagination);
    }

    // Two extra queries (not N+1 per row): printer counts grouped by
    // customer, and the first Agent found for each customer. Cheap at
    // list-page scale (a page of customers, not the whole tenant).
    const ids = data.map((c) => c.id);
    const [printerCounts, agents] = await Promise.all([
      this.tenantPrisma.client.printer.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids }, status: 'MONITORED' },
        _count: true,
      }),
      this.tenantPrisma.client.agent.findMany({
        // customerId is the primary link (set directly at creation — see
        // AgentsService.createEnrollment); fall back to locationId's own
        // customer for any Agent created before that field existed, so old
        // rows don't just silently stop showing up here.
        where: { OR: [{ customerId: { in: ids } }, { location: { customerId: { in: ids } } }] },
        select: {
          id: true,
          status: true,
          enrollmentToken: true,
          customerId: true,
          location: { select: { customerId: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const printerCountByCustomer = new Map(printerCounts.map((p) => [p.customerId, p._count]));

    // A customer can have more than one Agent (an old, already-enrolled one
    // sitting OFFLINE, and a freshly-generated PENDING one waiting to be
    // installed) — picking whichever happened to be created first used to
    // silently hide a brand new install token behind a long-dead Agent.
    // PENDING (has a copyable token) always wins; otherwise the most
    // recently created Agent represents this customer.
    const STATUS_PRIORITY: Record<string, number> = { PENDING: 0, ONLINE: 1, OFFLINE: 2, DISABLED: 3 };
    type AgentSummary = { id: string; status: string; enrollmentToken: string | null };
    const agentByCustomer = new Map<string, AgentSummary>();
    for (const agent of agents) {
      const customerId = agent.customerId ?? agent.location?.customerId;
      if (!customerId) continue;
      const current = agentByCustomer.get(customerId);
      if (!current || STATUS_PRIORITY[agent.status] < STATUS_PRIORITY[current.status]) {
        agentByCustomer.set(customerId, { id: agent.id, status: agent.status, enrollmentToken: agent.enrollmentToken });
      }
    }

    const enriched = data.map((customer) => ({
      ...customer,
      monitoredPrinterCount: printerCountByCustomer.get(customer.id) ?? 0,
      agent: agentByCustomer.get(customer.id) ?? null,
    }));

    return paginated(enriched, total, pagination);
  }

  async findOne(id: string) {
    const customer = await this.tenantPrisma.client.customer.findFirst({
      where: { id },
      include: { locations: true },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.tenantPrisma.client.customer.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.tenantPrisma.client.customer.delete({ where: { id } });
  }

  /** Merges service orders, contracts and monthly closings into one chronological feed — same pattern as PrintersService.timeline(), at customer scale. */
  async history(id: string) {
    await this.findOne(id);
    const [serviceOrders, contracts, closings] = await Promise.all([
      this.tenantPrisma.client.serviceOrder.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' } }),
      this.tenantPrisma.client.contract.findMany({ where: { customerId: id }, orderBy: { createdAt: 'desc' } }),
      this.tenantPrisma.client.monthlyClosing.findMany({ where: { customerId: id }, orderBy: { generatedAt: 'desc' } }),
    ]);

    const items = [
      ...serviceOrders.map((o) => ({
        type: 'service_order' as const,
        date: o.completedAt ?? o.createdAt,
        status: o.status,
        label: `OS #${o.number}${o.type ? ` — ${o.type}` : ''}`,
        notes: o.description,
      })),
      ...contracts.map((c) => ({
        type: 'contract' as const,
        date: c.createdAt,
        status: c.status,
        label: `Contrato #${c.number}`,
        notes: null as string | null,
      })),
      ...closings.map((m) => ({
        type: 'monthly_closing' as const,
        date: m.generatedAt,
        status: null as string | null,
        label: `Fechamento ${String(m.referenceMonth).padStart(2, '0')}/${m.referenceYear}`,
        notes: null as string | null,
      })),
    ];

    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async getWorkingHours(customerId: string) {
    await this.findOne(customerId);
    return this.tenantPrisma.client.customerWorkingHours.findMany({
      where: { customerId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  /** Replaces the whole set — simpler and safer than diffing individual rows for a small, fully-owned child list (same pattern as ContractFixedCost editing). */
  async setWorkingHours(customerId: string, dto: SetWorkingHoursDto) {
    await this.findOne(customerId);
    await this.tenantPrisma.client.customerWorkingHours.deleteMany({ where: { customerId } });
    if (dto.hours.length > 0) {
      await this.tenantPrisma.client.customerWorkingHours.createMany({
        data: dto.hours.map((h) => ({ ...h, customerId })) as any,
      });
    }
    return this.getWorkingHours(customerId);
  }
}
