import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { paginated } from '../common/dto/pagination.dto';
import type { ListPrintersQueryDto } from './dto/list-printers-query.dto';
import type { ClaimPrinterDto } from './dto/claim-printer.dto';

@Injectable()
export class PrintersService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

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
        agent: { select: { id: true, name: true, status: true } },
        counters: { orderBy: { collectedAt: 'desc' }, take: 50 },
        consumables: { orderBy: { collectedAt: 'desc' }, take: 50 },
      },
    });
    if (!printer) {
      throw new NotFoundException('Impressora não encontrada');
    }
    return printer;
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
      data: { customerId: dto.customerId, locationId: dto.locationId, status: 'MONITORED' },
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

  /** Manual correction of vendor-reported fields (spec §18: not every device reports these accurately). */
  async update(id: string, dto: { manufacturer?: string; model?: string; hostname?: string }) {
    await this.findOne(id);
    return this.tenantPrisma.client.printer.update({ where: { id }, data: dto });
  }
}
