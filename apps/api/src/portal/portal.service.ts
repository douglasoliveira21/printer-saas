import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { CreatePortalServiceOrderDto } from './dto/create-portal-service-order.dto';

@Injectable()
export class PortalService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  printers(customerId: string) {
    return this.tenantPrisma.client.printer.findMany({
      where: { customerId, status: 'MONITORED' },
      include: { location: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async printer(customerId: string, printerId: string) {
    const printer = await this.tenantPrisma.client.printer.findFirst({
      where: { id: printerId, customerId },
      include: {
        counters: { orderBy: { collectedAt: 'desc' }, take: 20 },
        consumables: { orderBy: { collectedAt: 'desc' }, take: 20 },
      },
    });
    if (!printer) {
      throw new NotFoundException('Impressora não encontrada');
    }
    return printer;
  }

  serviceOrders(customerId: string) {
    return this.tenantPrisma.client.serviceOrder.findMany({
      where: { customerId },
      include: { printer: { select: { id: true, model: true, ip: true } }, technician: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createServiceOrder(customerId: string, dto: CreatePortalServiceOrderDto) {
    if (dto.printerId) {
      const printer = await this.tenantPrisma.client.printer.findFirst({ where: { id: dto.printerId, customerId } });
      if (!printer) {
        throw new NotFoundException('Impressora não encontrada');
      }
    }

    const last = await this.tenantPrisma.client.serviceOrder.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    return this.tenantPrisma.client.serviceOrder.create({
      data: {
        number: (last?.number ?? 0) + 1,
        customerId,
        printerId: dto.printerId,
        description: dto.description,
        status: 'OPEN',
        priority: 'MEDIUM',
        type: 'Chamado do portal',
      } as any,
    });
  }

  contracts(customerId: string) {
    return this.tenantPrisma.client.contract.findMany({
      where: { customerId },
      include: { printer: { select: { id: true, model: true } } },
      orderBy: { number: 'desc' },
    });
  }
}
