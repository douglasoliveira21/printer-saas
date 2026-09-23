import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import type { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  findAll() {
    return this.tenantPrisma.client.department.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { printers: true } } },
    });
  }

  create(dto: CreateDepartmentDto) {
    return this.tenantPrisma.client.department.create({ data: dto as any });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.assertExists(id);
    return this.tenantPrisma.client.department.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const department = await this.tenantPrisma.client.department.findFirst({
      where: { id },
      include: { _count: { select: { printers: true } } },
    });
    if (!department) {
      throw new NotFoundException('Departamento não encontrado');
    }
    if (department._count.printers > 0) {
      throw new BadRequestException('Este departamento ainda está em uso por impressoras — reatribua-as antes de excluir.');
    }
    await this.tenantPrisma.client.department.delete({ where: { id } });
    return { removed: true };
  }

  private async assertExists(id: string) {
    const department = await this.tenantPrisma.client.department.findFirst({ where: { id } });
    if (!department) {
      throw new NotFoundException('Departamento não encontrado');
    }
  }
}
