import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { CreateLocationDto } from './dto/create-location.dto';
import type { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(dto: CreateLocationDto) {
    // Prisma's tenant-scoped extension prevents cross-tenant writes on
    // Location itself, but the FK target (customerId) must be validated
    // explicitly: nothing stops an attacker from supplying another
    // tenant's customerId otherwise.
    await this.assertCustomerBelongsToTenant(dto.customerId);
    // tenantId is injected at runtime by the tenant-scoped Prisma extension.
    return this.tenantPrisma.client.location.create({ data: dto as any });
  }

  findByCustomer(customerId: string) {
    return this.tenantPrisma.client.location.findMany({ where: { customerId } });
  }

  async findOne(id: string) {
    const location = await this.tenantPrisma.client.location.findFirst({ where: { id } });
    if (!location) {
      throw new NotFoundException('Local não encontrado');
    }
    return location;
  }

  async update(id: string, dto: UpdateLocationDto) {
    await this.findOne(id);
    if (dto.customerId) {
      await this.assertCustomerBelongsToTenant(dto.customerId);
    }
    return this.tenantPrisma.client.location.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.tenantPrisma.client.location.delete({ where: { id } });
  }

  private async assertCustomerBelongsToTenant(customerId: string) {
    const customer = await this.tenantPrisma.client.customer.findFirst({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
  }
}
