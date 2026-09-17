import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import type { CreateMovementDto } from './dto/create-movement.dto';

@Injectable()
export class InventoryService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
  ) {}

  create(dto: CreateInventoryItemDto) {
    return this.tenantPrisma.client.inventoryItem.create({
      data: { name: dto.name, type: dto.type, minQuantity: dto.minQuantity ?? 0 } as any,
    });
  }

  findAll() {
    return this.tenantPrisma.client.inventoryItem.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const item = await this.tenantPrisma.client.inventoryItem.findFirst({
      where: { id },
      include: { movements: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!item) {
      throw new NotFoundException('Item de estoque não encontrado');
    }
    return item;
  }

  async update(id: string, dto: Partial<CreateInventoryItemDto>) {
    await this.findOne(id);
    return this.tenantPrisma.client.inventoryItem.update({
      where: { id },
      data: { name: dto.name, type: dto.type, minQuantity: dto.minQuantity },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.tenantPrisma.client.inventoryItem.delete({ where: { id } });
  }

  /**
   * Records a stock movement and updates the running quantity atomically.
   * Uses the raw (tenant-unscoped) client inside a transaction because
   * Prisma's interactive transactions don't compose with the tenant-scoped
   * extension's per-call wrapping — tenant ownership of `itemId` and
   * `serviceOrderId` is verified explicitly beforehand instead.
   */
  async createMovement(itemId: string, dto: CreateMovementDto) {
    const item = await this.findOne(itemId);
    if (dto.serviceOrderId) {
      const so = await this.tenantPrisma.client.serviceOrder.findFirst({ where: { id: dto.serviceOrderId } });
      if (!so) {
        throw new NotFoundException('Ordem de serviço não encontrada');
      }
    }

    // IN/OUT: quantity is the amount moved (delta). ADJUSTMENT: quantity is
    // the corrected absolute stock count (e.g. after a physical recount),
    // since a delta can't express "set to X" with a positive-only DTO field.
    let newQuantity: number;
    if (dto.type === 'ADJUSTMENT') {
      newQuantity = dto.quantity;
    } else {
      const delta = dto.type === 'OUT' ? -dto.quantity : dto.quantity;
      newQuantity = item.quantity + delta;
      if (newQuantity < 0) {
        throw new BadRequestException(`Estoque insuficiente: disponível ${item.quantity}, solicitado ${dto.quantity}`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.inventoryMovement.create({
        data: {
          tenantId: this.tenantPrisma.tenantId,
          itemId,
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
          serviceOrderId: dto.serviceOrderId,
        },
      });
      await tx.inventoryItem.update({ where: { id: itemId }, data: { quantity: newQuantity } });
      return movement;
    });
  }
}
