import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { CreateSupplyLevelFilterDto } from './dto/supply-level-filter.dto';

@Injectable()
export class SupplyLevelFiltersService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  findAll() {
    return this.tenantPrisma.client.supplyLevelFilter.findMany({
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { id: true, legalName: true, tradeName: true } } },
    });
  }

  create(dto: CreateSupplyLevelFilterDto) {
    return this.tenantPrisma.client.supplyLevelFilter.create({
      data: { name: dto.name, customerId: dto.customerId } as any,
      include: { customer: { select: { id: true, legalName: true, tradeName: true } } },
    });
  }

  async remove(id: string) {
    const filter = await this.tenantPrisma.client.supplyLevelFilter.findFirst({ where: { id } });
    if (!filter) {
      throw new NotFoundException('Filtro não encontrado');
    }
    await this.tenantPrisma.client.supplyLevelFilter.delete({ where: { id } });
    return { removed: true };
  }

  /**
   * The actual "níveis dos suprimentos" table for a filter — always fetched
   * live from the printers/consumables the customer has right now (the
   * filter itself only remembers which customer, never a data snapshot), one
   * row per physical consumable item, keyed the same way the printer detail
   * page dedupes readings (spec: latest reading per item, not full history).
   */
  async rows(id: string) {
    const filter = await this.tenantPrisma.client.supplyLevelFilter.findFirst({ where: { id } });
    if (!filter) {
      throw new NotFoundException('Filtro não encontrado');
    }

    const printers = await this.tenantPrisma.client.printer.findMany({
      where: { customerId: filter.customerId, status: { not: 'DECOMMISSIONED' } },
      include: {
        customer: { select: { id: true, legalName: true, tradeName: true } },
        department: { select: { id: true, name: true } },
        consumables: { orderBy: { collectedAt: 'desc' }, take: 50 },
      },
    });

    const rows: Array<{
      printerId: string;
      manufacturer: string | null;
      model: string | null;
      serial: string | null;
      ip: string | null;
      customer: string;
      department: string | null;
      itemName: string | null;
      type: string;
      color: string | null;
      itemSerial: string | null;
      levelPercent: number | null;
      collectedAt: Date;
    }> = [];

    for (const printer of printers) {
      const latestByKey = new Map<string, (typeof printer.consumables)[number]>();
      for (const c of printer.consumables) {
        const key = c.name ?? `${c.type}:${c.color ?? 'default'}`;
        if (!latestByKey.has(key)) {
          latestByKey.set(key, c);
        }
      }

      for (const c of latestByKey.values()) {
        rows.push({
          printerId: printer.id,
          manufacturer: printer.manufacturer,
          model: printer.model,
          serial: printer.serial,
          ip: printer.ip,
          customer: printer.customer?.tradeName || printer.customer?.legalName || '—',
          department: printer.department?.name ?? null,
          itemName: c.name,
          type: c.type,
          color: c.color,
          itemSerial: c.serial,
          levelPercent: c.levelPercent,
          collectedAt: c.collectedAt,
        });
      }
    }

    return { filter, rows };
  }
}
