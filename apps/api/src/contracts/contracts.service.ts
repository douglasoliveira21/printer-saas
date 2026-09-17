import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { paginated, type PaginationDto } from '../common/dto/pagination.dto';
import { calculateFranchiseBilling, calculatePeriodUsage } from './billing.util';
import type { CreateContractDto } from './dto/create-contract.dto';
import type { UpdateContractDto } from './dto/update-contract.dto';

@Injectable()
export class ContractsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(dto: CreateContractDto) {
    await this.assertCustomerBelongsToTenant(dto.customerId);
    if (dto.printerId) {
      const printer = await this.tenantPrisma.client.printer.findFirst({ where: { id: dto.printerId } });
      if (!printer) {
        throw new NotFoundException('Impressora não encontrada');
      }
    }

    const last = await this.tenantPrisma.client.contract.findFirst({ orderBy: { number: 'desc' }, select: { number: true } });

    return this.tenantPrisma.client.contract.create({
      data: {
        number: (last?.number ?? 0) + 1,
        customerId: dto.customerId,
        printerId: dto.printerId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        monthlyFee: dto.monthlyFee,
        franchisePages: dto.franchisePages ?? 0,
        overagePriceBw: dto.overagePriceBw ?? 0,
        overagePriceColor: dto.overagePriceColor ?? 0,
        billingDay: dto.billingDay ?? 1,
        slaHours: dto.slaHours,
        readjustmentIndex: dto.readjustmentIndex,
        notes: dto.notes,
        status: 'DRAFT',
      } as any,
    });
  }

  async findAll(pagination: PaginationDto) {
    const [data, total] = await Promise.all([
      this.tenantPrisma.client.contract.findMany({
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { number: 'desc' },
        include: {
          customer: { select: { id: true, legalName: true, tradeName: true } },
          printer: { select: { id: true, model: true, ip: true } },
        },
      }),
      this.tenantPrisma.client.contract.count(),
    ]);
    return paginated(data, total, pagination);
  }

  async findOne(id: string) {
    const contract = await this.tenantPrisma.client.contract.findFirst({
      where: { id },
      include: { customer: true, printer: true },
    });
    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }
    return contract;
  }

  async update(id: string, dto: UpdateContractDto) {
    await this.findOne(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    return this.tenantPrisma.client.contract.update({ where: { id }, data: data as any });
  }

  /**
   * Franchise/overage preview for a billing period (spec §29-30). Never
   * estimates: if the printer didn't report enough counter readings in the
   * period, `dataAvailable` comes back false instead of a guessed total.
   */
  async billingPreview(id: string, from: Date, to: Date) {
    const contract = await this.findOne(id);
    if (!contract.printerId) {
      throw new BadRequestException('Contrato não está vinculado a uma impressora');
    }

    const readings = await this.tenantPrisma.client.counterReading.findMany({
      where: { printerId: contract.printerId, collectedAt: { gte: from, lte: to } },
      orderBy: { collectedAt: 'asc' },
    });

    const usage = calculatePeriodUsage(readings, 'total', from, to);
    const billing = calculateFranchiseBilling({
      franchisePages: contract.franchisePages,
      monthlyFee: Number(contract.monthlyFee),
      overagePricePerPage: Number(contract.overagePriceBw),
      usage,
    });

    return { period: { from, to }, ...billing };
  }

  private async assertCustomerBelongsToTenant(customerId: string) {
    const customer = await this.tenantPrisma.client.customer.findFirst({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
  }
}
