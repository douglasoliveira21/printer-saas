import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class AlertsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  findAll(status?: string, printerId?: string, serviceOrderId?: string) {
    return this.tenantPrisma.client.alert.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(printerId ? { printerId } : {}),
        ...(serviceOrderId ? { serviceOrderId } : {}),
      },
      include: { printer: { select: { id: true, model: true, ip: true, customer: { select: { legalName: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async acknowledge(id: string) {
    await this.assertExists(id);
    return this.tenantPrisma.client.alert.update({ where: { id }, data: { status: 'ACKNOWLEDGED' } });
  }

  async resolve(id: string) {
    await this.assertExists(id);
    return this.tenantPrisma.client.alert.update({ where: { id }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
  }

  private async assertExists(id: string) {
    const alert = await this.tenantPrisma.client.alert.findFirst({ where: { id } });
    if (!alert) {
      throw new NotFoundException('Alerta não encontrado');
    }
  }
}
