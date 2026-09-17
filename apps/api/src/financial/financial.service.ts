import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { paginated } from '../common/dto/pagination.dto';
import type { CreateFinancialEntryDto } from './dto/create-financial-entry.dto';
import type { ListFinancialEntriesQueryDto } from './dto/list-financial-entries-query.dto';
import type { UpdateFinancialEntryDto } from './dto/update-financial-entry.dto';

@Injectable()
export class FinancialService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(dto: CreateFinancialEntryDto) {
    if (dto.customerId) await this.assertBelongsToTenant('customer', dto.customerId);
    if (dto.contractId) await this.assertBelongsToTenant('contract', dto.contractId);
    if (dto.serviceOrderId) await this.assertBelongsToTenant('serviceOrder', dto.serviceOrderId);

    return this.tenantPrisma.client.financialEntry.create({
      data: {
        type: dto.type,
        category: dto.category,
        costCenter: dto.costCenter,
        description: dto.description,
        amount: dto.amount,
        dueDate: new Date(dto.dueDate),
        customerId: dto.customerId,
        contractId: dto.contractId,
        serviceOrderId: dto.serviceOrderId,
      } as any,
    });
  }

  async findAll(query: ListFinancialEntriesQueryDto) {
    const where = {
      ...(query.type ? { type: query.type as any } : {}),
      ...(query.status ? { status: query.status as any } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.financialEntry.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { dueDate: 'asc' },
        include: {
          customer: { select: { id: true, legalName: true, tradeName: true } },
          contract: { select: { id: true, number: true } },
          serviceOrder: { select: { id: true, number: true } },
        },
      }),
      this.tenantPrisma.client.financialEntry.count({ where }),
    ]);

    return paginated(data, total, query);
  }

  async update(id: string, dto: UpdateFinancialEntryDto) {
    const entry = await this.findOne(id);
    if (entry.status !== 'PENDING') {
      throw new BadRequestException('Só é possível editar lançamentos pendentes');
    }
    return this.tenantPrisma.client.financialEntry.update({
      where: { id },
      data: {
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async markPaid(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.financialEntry.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  async cancel(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.financialEntry.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  /** Cash flow snapshot for the financial dashboard (spec §31). */
  async summary() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const client = this.tenantPrisma.client;

    const [receivableToday, receivableOverdue, receivableUpcoming, payablePending] = await Promise.all([
      client.financialEntry.aggregate({
        where: { type: 'RECEIVABLE', status: 'PENDING', dueDate: { gte: startOfToday, lte: endOfToday } },
        _sum: { amount: true },
      }),
      client.financialEntry.aggregate({
        where: { type: 'RECEIVABLE', status: 'PENDING', dueDate: { lt: startOfToday } },
        _sum: { amount: true },
      }),
      client.financialEntry.aggregate({
        where: { type: 'RECEIVABLE', status: 'PENDING', dueDate: { gt: endOfToday } },
        _sum: { amount: true },
      }),
      client.financialEntry.aggregate({
        where: { type: 'PAYABLE', status: 'PENDING' },
        _sum: { amount: true },
      }),
    ]);

    const receivableTodayAmount = Number(receivableToday._sum.amount ?? 0);
    const receivableOverdueAmount = Number(receivableOverdue._sum.amount ?? 0);
    const receivableUpcomingAmount = Number(receivableUpcoming._sum.amount ?? 0);
    const payableAmount = Number(payablePending._sum.amount ?? 0);

    return {
      receivableToday: receivableTodayAmount,
      receivableOverdue: receivableOverdueAmount,
      receivableUpcoming: receivableUpcomingAmount,
      payablePending: payableAmount,
      projectedBalance: receivableTodayAmount + receivableOverdueAmount + receivableUpcomingAmount - payableAmount,
    };
  }

  private async findOne(id: string) {
    const entry = await this.tenantPrisma.client.financialEntry.findFirst({ where: { id } });
    if (!entry) {
      throw new NotFoundException('Lançamento financeiro não encontrado');
    }
    return entry;
  }

  private async assertBelongsToTenant(model: 'customer' | 'contract' | 'serviceOrder', id: string) {
    const record = await (this.tenantPrisma.client[model] as any).findFirst({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Registro (${model}) não encontrado`);
    }
  }
}
