import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import type { CreateServiceOrderTypeDto, UpdateServiceOrderTypeDto } from './dto/service-order-type.dto';

@Injectable()
export class ServiceOrderTypesService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  findAll() {
    return this.tenantPrisma.client.serviceOrderTypeCatalog.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateServiceOrderTypeDto) {
    return this.tenantPrisma.client.serviceOrderTypeCatalog.create({
      data: { name: dto.name, defaultPrice: dto.defaultPrice, blankLinesOnPrint: dto.blankLinesOnPrint ?? 0 } as any,
    });
  }

  async update(id: string, dto: UpdateServiceOrderTypeDto) {
    await this.assertExists(id);
    return this.tenantPrisma.client.serviceOrderTypeCatalog.update({ where: { id }, data: dto as any });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.tenantPrisma.client.serviceOrderTypeCatalog.delete({ where: { id } });
    return { removed: true };
  }

  private async assertExists(id: string) {
    const entry = await this.tenantPrisma.client.serviceOrderTypeCatalog.findFirst({ where: { id } });
    if (!entry) {
      throw new NotFoundException('Tipo de chamado não encontrado');
    }
  }
}
