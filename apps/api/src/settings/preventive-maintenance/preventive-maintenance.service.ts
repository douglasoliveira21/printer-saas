import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import type { CreatePreventiveMaintenanceScheduleDto, UpdatePreventiveMaintenanceScheduleDto } from './dto/preventive-maintenance.dto';

@Injectable()
export class PreventiveMaintenanceService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  findAll() {
    return this.tenantPrisma.client.preventiveMaintenanceSchedule.findMany({
      orderBy: { nextDueAt: 'asc' },
      include: { printer: { select: { id: true, manufacturer: true, model: true, serial: true } } },
    });
  }

  async create(dto: CreatePreventiveMaintenanceScheduleDto) {
    const printer = await this.tenantPrisma.client.printer.findFirst({ where: { id: dto.printerId } });
    if (!printer) {
      throw new NotFoundException('Impressora não encontrada');
    }
    const nextDueAt = new Date();
    nextDueAt.setDate(nextDueAt.getDate() + dto.intervalDays);

    return this.tenantPrisma.client.preventiveMaintenanceSchedule.create({
      data: { printerId: dto.printerId, intervalDays: dto.intervalDays, notes: dto.notes, nextDueAt } as any,
      include: { printer: { select: { id: true, manufacturer: true, model: true, serial: true } } },
    });
  }

  async update(id: string, dto: UpdatePreventiveMaintenanceScheduleDto) {
    await this.assertExists(id);
    return this.tenantPrisma.client.preventiveMaintenanceSchedule.update({
      where: { id },
      data: dto,
      include: { printer: { select: { id: true, manufacturer: true, model: true, serial: true } } },
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.tenantPrisma.client.preventiveMaintenanceSchedule.delete({ where: { id } });
    return { removed: true };
  }

  private async assertExists(id: string) {
    const schedule = await this.tenantPrisma.client.preventiveMaintenanceSchedule.findFirst({ where: { id } });
    if (!schedule) {
      throw new NotFoundException('Agendamento de manutenção preventiva não encontrado');
    }
  }
}
