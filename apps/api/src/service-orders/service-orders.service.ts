import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { paginated } from '../common/dto/pagination.dto';
import type { CreateServiceOrderDto } from './dto/create-service-order.dto';
import type { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import type { ListServiceOrdersQueryDto } from './dto/list-service-orders-query.dto';

@Injectable()
export class ServiceOrdersService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(dto: CreateServiceOrderDto) {
    await this.assertCustomerBelongsToTenant(dto.customerId);
    if (dto.locationId) await this.assertBelongsToTenant('location', dto.locationId);
    if (dto.printerId) await this.assertBelongsToTenant('printer', dto.printerId);
    if (dto.technicianId) await this.assertBelongsToTenant('user', dto.technicianId);

    // Per-tenant sequential number. Race-safe enough for MVP volume via a
    // serializable retry would be ideal, but a simple max+1 inside the
    // client's own tenant scope is fine at this scale — revisit with a
    // DB sequence per tenant if concurrent OS creation becomes common.
    const last = await this.tenantPrisma.client.serviceOrder.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    return this.tenantPrisma.client.serviceOrder.create({
      data: {
        number: (last?.number ?? 0) + 1,
        customerId: dto.customerId,
        locationId: dto.locationId,
        printerId: dto.printerId,
        technicianId: dto.technicianId,
        type: dto.type,
        priority: dto.priority,
        description: dto.description,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        slaDueAt: dto.slaDueAt ? new Date(dto.slaDueAt) : undefined,
      } as any,
    });
  }

  async findAll(query: ListServiceOrdersQueryDto) {
    const where = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.serviceOrder.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, legalName: true, tradeName: true } },
          location: { select: { id: true, name: true } },
          printer: { select: { id: true, model: true, ip: true } },
          technician: { select: { id: true, name: true } },
        },
      }),
      this.tenantPrisma.client.serviceOrder.count({ where }),
    ]);

    return paginated(data, total, query);
  }

  async findOne(id: string) {
    const serviceOrder = await this.tenantPrisma.client.serviceOrder.findFirst({
      where: { id },
      include: {
        customer: true,
        location: true,
        printer: true,
        technician: { select: { id: true, name: true, email: true } },
      },
    });
    if (!serviceOrder) {
      throw new NotFoundException('Ordem de serviço não encontrada');
    }
    return serviceOrder;
  }

  async update(id: string, dto: UpdateServiceOrderDto) {
    await this.findOne(id);
    if (dto.technicianId) await this.assertBelongsToTenant('user', dto.technicianId);

    const data: Record<string, unknown> = { ...dto };
    if (dto.scheduledAt) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.slaDueAt) data.slaDueAt = new Date(dto.slaDueAt);
    if (dto.startedAt) data.startedAt = new Date(dto.startedAt);
    if (dto.completedAt) data.completedAt = new Date(dto.completedAt);

    // Convenience: moving into IN_PROGRESS/DONE stamps the timestamp if the
    // caller didn't supply one explicitly, so the UI doesn't have to.
    if (dto.status === 'IN_PROGRESS' && !dto.startedAt) data.startedAt = new Date();
    if (dto.status === 'DONE' && !dto.completedAt) data.completedAt = new Date();

    return this.tenantPrisma.client.serviceOrder.update({ where: { id }, data: data as any });
  }

  private async assertCustomerBelongsToTenant(customerId: string) {
    const customer = await this.tenantPrisma.client.customer.findFirst({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
  }

  private async assertBelongsToTenant(model: 'location' | 'printer' | 'user', id: string) {
    const record = await (this.tenantPrisma.client[model] as any).findFirst({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Registro (${model}) não encontrado`);
    }
  }
}
