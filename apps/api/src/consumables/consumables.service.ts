import { Injectable, NotFoundException } from '@nestjs/common';
import { calculateSupplyForecast } from '@printer-saas/shared';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryMovementTypeDto } from '../inventory/dto/create-movement.dto';
import type { CreateReplacementDto } from './dto/create-replacement.dto';
import type { ListReplacementsQueryDto } from './dto/list-replacements-query.dto';

const FORECAST_LOOKBACK = 20;

@Injectable()
export class ConsumablesService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  /** Tenant-wide list of upcoming predicted supply replacements, most urgent first. */
  async forecast() {
    const printers = await this.tenantPrisma.client.printer.findMany({
      where: { status: 'MONITORED' },
      select: {
        id: true,
        model: true,
        ip: true,
        customer: { select: { id: true, legalName: true } },
        consumables: { orderBy: { collectedAt: 'desc' }, take: FORECAST_LOOKBACK },
      },
    });

    const results: Array<{
      printer: { id: string; model: string | null; ip: string | null };
      customer: { id: string; legalName: string } | null;
      type: string;
      color: string | null;
      currentLevelPercent: number;
      daysRemaining: number;
      predictedReplacementAt: Date;
    }> = [];

    for (const printer of printers) {
      const byKey = new Map<string, { type: string; color: string | null; readings: { levelPercent: number | null; collectedAt: Date }[] }>();
      for (const c of printer.consumables) {
        const key = `${c.type}:${c.color ?? 'default'}`;
        const entry = byKey.get(key) ?? { type: c.type, color: c.color, readings: [] };
        entry.readings.push({ levelPercent: c.levelPercent, collectedAt: c.collectedAt });
        byKey.set(key, entry);
      }

      for (const { type, color, readings } of byKey.values()) {
        const forecast = calculateSupplyForecast(readings);
        if (!forecast) continue;
        results.push({
          printer: { id: printer.id, model: printer.model, ip: printer.ip },
          customer: printer.customer,
          type,
          color,
          currentLevelPercent: forecast.currentLevelPercent,
          daysRemaining: forecast.daysRemaining,
          predictedReplacementAt: forecast.predictedReplacementAt,
        });

        // Keep a PREDICTED record around so there's history even before a
        // physical replacement happens (upsert-by-hand: no unique constraint
        // on printer+type+color+status, so update the latest open one).
        const existing = await this.tenantPrisma.client.consumableReplacement.findFirst({
          where: { printerId: printer.id, type, color, status: 'PREDICTED' },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) {
          await this.tenantPrisma.client.consumableReplacement.update({
            where: { id: existing.id },
            data: { predictedAt: forecast.predictedReplacementAt },
          });
        } else {
          await this.tenantPrisma.client.consumableReplacement.create({
            data: { printerId: printer.id, type, color, predictedAt: forecast.predictedReplacementAt, status: 'PREDICTED' } as any,
          });
        }
      }
    }

    return results.sort((a, b) => a.predictedReplacementAt.getTime() - b.predictedReplacementAt.getTime());
  }

  listReplacements(query: ListReplacementsQueryDto) {
    return this.tenantPrisma.client.consumableReplacement.findMany({
      where: query.status ? { status: query.status as any } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        printer: { select: { id: true, model: true, ip: true, customer: { select: { id: true, legalName: true } } } },
      },
      take: 200,
    });
  }

  /** Manual replacement logged by a user (technician swapped the part). */
  async createReplacement(printerId: string, dto: CreateReplacementDto) {
    const printer = await this.tenantPrisma.client.printer.findFirst({ where: { id: printerId } });
    if (!printer) {
      throw new NotFoundException('Impressora não encontrada');
    }

    const color = dto.color ?? null;

    let inventoryMovementId: string | undefined;
    if (dto.inventoryItemId) {
      const movement = await this.inventoryService.createMovement(dto.inventoryItemId, {
        type: InventoryMovementTypeDto.OUT,
        quantity: 1,
        reason: `Troca de suprimento (${dto.type}${dto.color ? ` ${dto.color}` : ''}) na impressora ${printer.model ?? printer.ip ?? printer.id}`,
      });
      inventoryMovementId = movement.id;
    }

    // Supersede any still-open PREDICTED record for this printer+type+color.
    await this.tenantPrisma.client.consumableReplacement.updateMany({
      where: { printerId, type: dto.type, color, status: 'PREDICTED' },
      data: { status: 'DISMISSED' },
    });

    return this.tenantPrisma.client.consumableReplacement.create({
      data: {
        printerId,
        type: dto.type,
        color,
        replacedAt: new Date(),
        status: 'CONFIRMED',
        notes: dto.notes,
        inventoryMovementId,
      } as any,
    });
  }
}
