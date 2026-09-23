import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { paginated } from '../common/dto/pagination.dto';
import { calculateFranchiseBilling, calculatePeriodUsage } from './billing.util';
import type { CreateContractDto } from './dto/create-contract.dto';
import type { UpdateContractDto } from './dto/update-contract.dto';
import type { ListContractsQueryDto } from './dto/list-contracts-query.dto';
import type { CreateContractPrinterDto, UpdateContractPrinterDto } from './dto/contract-printer.dto';
import type { CreateContractFixedCostDto } from './dto/contract-fixed-cost.dto';
import type { CreateContractPricingTierDto } from './dto/contract-pricing-tier.dto';
import type { CreateContractEmailDto } from './dto/contract-email.dto';
import type { CreateContractReadjustmentDto } from './dto/contract-readjustment.dto';

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
        defaultPriceBw: dto.defaultPriceBw,
        defaultPriceColor: dto.defaultPriceColor,
        defaultPriceScan: dto.defaultPriceScan,
        status: 'DRAFT',
      } as any,
    });
  }

  async findAll(query: ListContractsQueryDto) {
    const where = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { customer: { legalName: { contains: query.search, mode: 'insensitive' as const } } },
              { customer: { tradeName: { contains: query.search, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.contract.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { number: 'desc' },
        include: {
          customer: { select: { id: true, legalName: true, tradeName: true } },
          printer: { select: { id: true, model: true, ip: true } },
          _count: { select: { contractPrinters: true } },
        },
      }),
      this.tenantPrisma.client.contract.count({ where }),
    ]);
    return paginated(data, total, query);
  }

  async findOne(id: string) {
    const contract = await this.tenantPrisma.client.contract.findFirst({
      where: { id },
      include: {
        customer: true,
        printer: true,
        contractPrinters: {
          include: { printer: { select: { id: true, manufacturer: true, model: true, serial: true } } },
          orderBy: { createdAt: 'asc' },
        },
        fixedCosts: { orderBy: { createdAt: 'asc' } },
        pricingTiers: { orderBy: { fromPage: 'asc' } },
        emailRecipients: { orderBy: { createdAt: 'asc' } },
        readjustments: { orderBy: { createdAt: 'desc' } },
      },
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
    // endDate: undefined (key omitted) = leave as-is; null = clear it (contrato por tempo indeterminado).
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    return this.tenantPrisma.client.contract.update({ where: { id }, data: data as any });
  }

  /**
   * Franchise/overage preview for a billing period (spec §29-30). Never
   * estimates: if the printer didn't report enough counter readings in the
   * period, `dataAvailable` comes back false instead of a guessed total.
   * Kept for historical/legacy single-printer contracts — Fechamentos
   * (ClosingsService) uses the newer per-printer cost-per-page model instead.
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

  // ---------------------------------------------------------------------
  // Contract printers (multi-printer billing)
  // ---------------------------------------------------------------------

  async addPrinter(contractId: string, dto: CreateContractPrinterDto) {
    const contract = await this.findOne(contractId);
    const printer = await this.tenantPrisma.client.printer.findFirst({ where: { id: dto.printerId } });
    if (!printer) {
      throw new NotFoundException('Impressora não encontrada');
    }
    if (printer.customerId && printer.customerId !== contract.customerId) {
      throw new BadRequestException('Esta impressora pertence a outro cliente');
    }

    return this.tenantPrisma.client.contractPrinter.create({
      data: {
        contractId,
        printerId: dto.printerId,
        priceBw: dto.priceBw,
        priceColor: dto.priceColor,
        priceScan: dto.priceScan,
        fixedCost: dto.fixedCost ?? 0,
      } as any,
      include: { printer: { select: { id: true, manufacturer: true, model: true, serial: true } } },
    });
  }

  async updatePrinter(contractId: string, contractPrinterId: string, dto: UpdateContractPrinterDto) {
    await this.assertContractPrinterBelongs(contractId, contractPrinterId);
    return this.tenantPrisma.client.contractPrinter.update({
      where: { id: contractPrinterId },
      data: dto,
      include: { printer: { select: { id: true, manufacturer: true, model: true, serial: true } } },
    });
  }

  async removePrinter(contractId: string, contractPrinterId: string) {
    await this.assertContractPrinterBelongs(contractId, contractPrinterId);
    await this.tenantPrisma.client.contractPrinter.delete({ where: { id: contractPrinterId } });
  }

  // ---------------------------------------------------------------------
  // Fixed costs
  // ---------------------------------------------------------------------

  async addFixedCost(contractId: string, dto: CreateContractFixedCostDto) {
    await this.findOne(contractId);
    return this.tenantPrisma.client.contractFixedCost.create({ data: { contractId, ...dto } as any });
  }

  async removeFixedCost(contractId: string, costId: string) {
    const cost = await this.tenantPrisma.client.contractFixedCost.findFirst({ where: { id: costId, contractId } });
    if (!cost) {
      throw new NotFoundException('Custo fixo não encontrado');
    }
    await this.tenantPrisma.client.contractFixedCost.delete({ where: { id: costId } });
  }

  // ---------------------------------------------------------------------
  // Pricing tiers (faixas de páginas)
  // ---------------------------------------------------------------------

  async addPricingTier(contractId: string, dto: CreateContractPricingTierDto) {
    await this.findOne(contractId);
    return this.tenantPrisma.client.contractPricingTier.create({ data: { contractId, ...dto } as any });
  }

  async removePricingTier(contractId: string, tierId: string) {
    const tier = await this.tenantPrisma.client.contractPricingTier.findFirst({ where: { id: tierId, contractId } });
    if (!tier) {
      throw new NotFoundException('Faixa de página não encontrada');
    }
    await this.tenantPrisma.client.contractPricingTier.delete({ where: { id: tierId } });
  }

  // ---------------------------------------------------------------------
  // Email recipients
  // ---------------------------------------------------------------------

  async listEmails(contractId: string) {
    await this.findOne(contractId);
    return this.tenantPrisma.client.contractEmailRecipient.findMany({ where: { contractId }, orderBy: { createdAt: 'asc' } });
  }

  async addEmail(contractId: string, dto: CreateContractEmailDto) {
    await this.findOne(contractId);
    return this.tenantPrisma.client.contractEmailRecipient.create({ data: { contractId, ...dto } as any });
  }

  async removeEmail(contractId: string, emailId: string) {
    const email = await this.tenantPrisma.client.contractEmailRecipient.findFirst({ where: { id: emailId, contractId } });
    if (!email) {
      throw new NotFoundException('E-mail não encontrado');
    }
    await this.tenantPrisma.client.contractEmailRecipient.delete({ where: { id: emailId } });
  }

  // ---------------------------------------------------------------------
  // Readjustments
  // ---------------------------------------------------------------------

  async listReadjustments(contractId: string) {
    await this.findOne(contractId);
    return this.tenantPrisma.client.contractReadjustment.findMany({ where: { contractId }, orderBy: { createdAt: 'desc' } });
  }

  async createReadjustment(contractId: string, dto: CreateContractReadjustmentDto) {
    const contract = await this.findOne(contractId);

    if (!dto.applyNow) {
      return this.tenantPrisma.client.contractReadjustment.create({
        data: {
          contractId,
          percentage: dto.percentage,
          effectiveMonth: dto.effectiveMonth,
          effectiveYear: dto.effectiveYear,
          status: 'SCHEDULED',
        } as any,
      });
    }

    return this.applyReadjustmentNow(contract, dto.percentage, dto.effectiveMonth, dto.effectiveYear);
  }

  async applyReadjustment(contractId: string, readjustmentId: string) {
    const contract = await this.findOne(contractId);
    const readjustment = await this.tenantPrisma.client.contractReadjustment.findFirst({ where: { id: readjustmentId, contractId } });
    if (!readjustment) {
      throw new NotFoundException('Reajuste não encontrado');
    }
    if (readjustment.status !== 'SCHEDULED') {
      throw new BadRequestException('Este reajuste já foi aplicado ou cancelado');
    }

    const previousMonthlyFee = Number(contract.monthlyFee);
    const newMonthlyFee = Math.round(previousMonthlyFee * (1 + Number(readjustment.percentage) / 100) * 100) / 100;

    await this.tenantPrisma.client.contract.update({ where: { id: contractId }, data: { monthlyFee: newMonthlyFee } });
    return this.tenantPrisma.client.contractReadjustment.update({
      where: { id: readjustmentId },
      data: { status: 'APPLIED', appliedAt: new Date(), previousMonthlyFee, newMonthlyFee },
    });
  }

  private async applyReadjustmentNow(contract: { id: string; monthlyFee: unknown }, percentage: number, effectiveMonth: number, effectiveYear: number) {
    const previousMonthlyFee = Number(contract.monthlyFee);
    const newMonthlyFee = Math.round(previousMonthlyFee * (1 + percentage / 100) * 100) / 100;

    await this.tenantPrisma.client.contract.update({ where: { id: contract.id }, data: { monthlyFee: newMonthlyFee } });
    return this.tenantPrisma.client.contractReadjustment.create({
      data: {
        contractId: contract.id,
        percentage,
        effectiveMonth,
        effectiveYear,
        status: 'APPLIED',
        appliedAt: new Date(),
        previousMonthlyFee,
        newMonthlyFee,
      } as any,
    });
  }

  private async assertContractPrinterBelongs(contractId: string, contractPrinterId: string) {
    const cp = await this.tenantPrisma.client.contractPrinter.findFirst({ where: { id: contractPrinterId, contractId } });
    if (!cp) {
      throw new NotFoundException('Impressora do contrato não encontrada');
    }
    return cp;
  }

  private async assertCustomerBelongsToTenant(customerId: string) {
    const customer = await this.tenantPrisma.client.customer.findFirst({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
  }
}
