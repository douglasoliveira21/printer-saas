import { Injectable } from '@nestjs/common';
import { calculatePeriodUsage } from '@printer-saas/shared';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

function defaultRange(from?: string, to?: string) {
  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(toDate.getFullYear(), toDate.getMonth(), 1);
  return { fromDate, toDate };
}

@Injectable()
export class ReportsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** Pages printed per monitored printer in the period (spec §33 — "Impressões por equipamento/cliente"). */
  async printersUsage(from?: string, to?: string) {
    const { fromDate, toDate } = defaultRange(from, to);
    const printers = await this.tenantPrisma.client.printer.findMany({
      where: { status: 'MONITORED' },
      include: {
        customer: { select: { legalName: true, tradeName: true } },
        counters: { where: { collectedAt: { gte: fromDate, lte: toDate } }, orderBy: { collectedAt: 'asc' } },
      },
    });

    return printers.map((printer) => {
      const total = calculatePeriodUsage(printer.counters, 'total', fromDate, toDate);
      const bw = calculatePeriodUsage(printer.counters, 'blackWhite', fromDate, toDate);
      const color = calculatePeriodUsage(printer.counters, 'color', fromDate, toDate);
      return {
        printerId: printer.id,
        customer: printer.customer?.tradeName || printer.customer?.legalName || null,
        manufacturer: printer.manufacturer,
        model: printer.model,
        serial: printer.serial,
        totalPages: total.pagesUsed,
        blackWhitePages: bw.pagesUsed,
        colorPages: color.pagesUsed,
        dataAvailable: total.pagesUsed !== null,
      };
    });
  }

  async serviceOrders(from?: string, to?: string, status?: string) {
    const { fromDate, toDate } = defaultRange(from, to);
    const orders = await this.tenantPrisma.client.serviceOrder.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
        ...(status ? { status: status as any } : {}),
      },
      include: {
        customer: { select: { legalName: true, tradeName: true } },
        technician: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return orders.map((order) => ({
      number: order.number,
      customer: order.customer?.tradeName || order.customer?.legalName || null,
      technician: order.technician?.name ?? null,
      priority: order.priority,
      status: order.status,
      createdAt: order.createdAt,
      completedAt: order.completedAt,
      slaDueAt: order.slaDueAt,
      late: !!order.slaDueAt && !['DONE', 'CANCELLED'].includes(order.status) && order.slaDueAt < new Date(),
    }));
  }

  async financial(from?: string, to?: string, type?: string) {
    const { fromDate, toDate } = defaultRange(from, to);
    const entries = await this.tenantPrisma.client.financialEntry.findMany({
      where: {
        dueDate: { gte: fromDate, lte: toDate },
        ...(type ? { type: type as any } : {}),
      },
      include: { customer: { select: { legalName: true, tradeName: true } } },
      orderBy: { dueDate: 'asc' },
    });

    return entries.map((entry) => ({
      type: entry.type,
      category: entry.category,
      customer: entry.customer?.tradeName || entry.customer?.legalName || null,
      description: entry.description,
      amount: Number(entry.amount),
      dueDate: entry.dueDate,
      status: entry.status,
      paidAt: entry.paidAt,
    }));
  }

  async offlinePrinters() {
    const printers = await this.tenantPrisma.client.printer.findMany({
      where: { status: 'MONITORED', onlineStatus: 'OFFLINE' },
      include: { customer: { select: { legalName: true, tradeName: true } }, location: { select: { name: true } } },
      orderBy: { lastSeenAt: 'asc' },
    });

    return printers.map((printer) => ({
      customer: printer.customer?.tradeName || printer.customer?.legalName || null,
      location: printer.location?.name ?? null,
      manufacturer: printer.manufacturer,
      model: printer.model,
      ip: printer.ip,
      lastSeenAt: printer.lastSeenAt,
    }));
  }

  async contractsExpiring(days = 30) {
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const contracts = await this.tenantPrisma.client.contract.findMany({
      where: { status: 'ACTIVE', endDate: { not: null, lte: cutoff } },
      include: { customer: { select: { legalName: true, tradeName: true } } },
      orderBy: { endDate: 'asc' },
    });

    return contracts.map((contract) => ({
      number: contract.number,
      customer: contract.customer?.tradeName || contract.customer?.legalName || null,
      endDate: contract.endDate,
      monthlyFee: Number(contract.monthlyFee),
    }));
  }
}
