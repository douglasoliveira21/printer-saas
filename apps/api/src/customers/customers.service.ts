import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { PaginationDto, paginated } from '../common/dto/pagination.dto';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

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

    return paginated(data, total, pagination);
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
}
