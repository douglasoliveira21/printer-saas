import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { calculatePeriodUsage } from '@printer-saas/shared';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

interface PrinterLine {
  printerId: string;
  printerModel: string | null;
  pagesBw: number | null;
  pagesColor: number | null;
  pagesScan: number | null;
  priceBw: number;
  priceColor: number;
  priceScan: number;
  fixedCost: number;
  lineTotal: number;
  dataAvailable: boolean;
}

interface ContractLine {
  contractId: string;
  contractNumber: number;
  monthlyFee: number;
  fixedCosts: { label: string; amount: number }[];
  printers: PrinterLine[];
  contractTotal: number;
}

@Injectable()
export class ClosingsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /**
   * Generates (or regenerates) a customer's monthly closing from their
   * active contracts, using each contract's per-printer cost-per-page
   * pricing (ContractPrinter, falling back to the contract's default*
   * price when a printer has no override) — the franchise/overage model
   * (Contract.franchisePages/overagePrice*) is no longer used for billing.
   */
  async generate(customerId: string, year: number, month: number) {
    const customer = await this.tenantPrisma.client.customer.findFirst({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);

    const contracts = await this.tenantPrisma.client.contract.findMany({
      where: { customerId, status: 'ACTIVE' },
      include: {
        fixedCosts: true,
        contractPrinters: { include: { printer: { select: { id: true, model: true, ip: true } } } },
      },
    });

    const contractLines: ContractLine[] = [];
    for (const contract of contracts) {
      const monthlyFee = Number(contract.monthlyFee);
      const fixedCosts = contract.fixedCosts.map((c) => ({ label: c.label, amount: Number(c.amount) }));

      const printerLines: PrinterLine[] = [];
      for (const cp of contract.contractPrinters) {
        const readings = await this.tenantPrisma.client.counterReading.findMany({
          where: { printerId: cp.printerId, collectedAt: { gte: from, lte: to } },
          orderBy: { collectedAt: 'asc' },
        });

        const bw = calculatePeriodUsage(readings, 'blackWhite', from, to);
        const color = calculatePeriodUsage(readings, 'color', from, to);
        const scan = calculatePeriodUsage(readings, 'copies', from, to);

        const priceBw = Number(cp.priceBw ?? contract.defaultPriceBw ?? 0);
        const priceColor = Number(cp.priceColor ?? contract.defaultPriceColor ?? 0);
        const priceScan = Number(cp.priceScan ?? contract.defaultPriceScan ?? 0);
        const fixedCost = Number(cp.fixedCost);

        const dataAvailable = bw.pagesUsed !== null || color.pagesUsed !== null || scan.pagesUsed !== null;
        const lineTotal =
          (bw.pagesUsed ?? 0) * priceBw + (color.pagesUsed ?? 0) * priceColor + (scan.pagesUsed ?? 0) * priceScan + fixedCost;

        printerLines.push({
          printerId: cp.printerId,
          printerModel: cp.printer.model ?? cp.printer.ip ?? null,
          pagesBw: bw.pagesUsed,
          pagesColor: color.pagesUsed,
          pagesScan: scan.pagesUsed,
          priceBw,
          priceColor,
          priceScan,
          fixedCost,
          lineTotal: Math.round(lineTotal * 100) / 100,
          dataAvailable,
        });
      }

      const contractTotal =
        monthlyFee + fixedCosts.reduce((s, c) => s + c.amount, 0) + printerLines.reduce((s, p) => s + p.lineTotal, 0);

      contractLines.push({
        contractId: contract.id,
        contractNumber: contract.number,
        monthlyFee,
        fixedCosts,
        printers: printerLines,
        contractTotal: Math.round(contractTotal * 100) / 100,
      });
    }

    const totalAmount = contractLines.reduce((sum, c) => sum + c.contractTotal, 0);

    return this.tenantPrisma.client.monthlyClosing.upsert({
      where: { tenantId_customerId_referenceYear_referenceMonth: { tenantId: this.tenantPrisma.tenantId, customerId, referenceYear: year, referenceMonth: month } },
      update: { totalAmount, details: contractLines as any, generatedAt: new Date() },
      create: { customerId, referenceYear: year, referenceMonth: month, totalAmount, details: contractLines as any } as any,
    });
  }

  async findAllForCustomer(customerId: string, year?: number) {
    return this.tenantPrisma.client.monthlyClosing.findMany({
      where: { customerId, ...(year ? { referenceYear: year } : {}) },
      orderBy: [{ referenceYear: 'desc' }, { referenceMonth: 'desc' }],
    });
  }

  async findOne(id: string) {
    const closing = await this.tenantPrisma.client.monthlyClosing.findFirst({
      where: { id },
      include: { customer: { select: { id: true, legalName: true, tradeName: true } } },
    });
    if (!closing) {
      throw new NotFoundException('Fechamento não encontrado');
    }
    return closing;
  }

  async generatePdf(id: string): Promise<Buffer> {
    const closing = await this.findOne(id);
    const contractLines = closing.details as unknown as ContractLine[];

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const customerName = closing.customer.tradeName || closing.customer.legalName;
    doc.fontSize(18).text('Fechamento mensal', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Cliente: ${customerName}`);
    doc.text(`Período: ${String(closing.referenceMonth).padStart(2, '0')}/${closing.referenceYear}`);
    doc.text(`Gerado em: ${closing.generatedAt.toLocaleString('pt-BR')}`);
    doc.moveDown();

    for (const contract of contractLines) {
      doc.fontSize(12).text(`Contrato #${contract.contractNumber} — Mensalidade: R$ ${contract.monthlyFee.toFixed(2)}`, { underline: true });
      doc.moveDown(0.3);
      for (const p of contract.printers) {
        doc.fontSize(10).text(
          `${p.printerModel ?? p.printerId}\n` +
            `  P&B: ${p.pagesBw ?? 'Não disponível'} × R$ ${p.priceBw.toFixed(4)} | Colorida: ${p.pagesColor ?? 'Não disponível'} × R$ ${p.priceColor.toFixed(4)} | Digitalização: ${p.pagesScan ?? 'Não disponível'} × R$ ${p.priceScan.toFixed(4)}\n` +
            `  Custo fixo: R$ ${p.fixedCost.toFixed(2)} | Total da impressora: R$ ${p.lineTotal.toFixed(2)}`,
        );
        doc.moveDown(0.3);
      }
      for (const fc of contract.fixedCosts) {
        doc.fontSize(10).text(`Custo adicional — ${fc.label}: R$ ${fc.amount.toFixed(2)}`);
      }
      doc.fontSize(11).text(`Total do contrato: R$ ${contract.contractTotal.toFixed(2)}`, { align: 'right' });
      doc.moveDown();
    }

    doc.moveDown();
    doc.fontSize(14).text(`Total do fechamento: R$ ${Number(closing.totalAmount).toFixed(2)}`, { align: 'right' });

    doc.end();
    return done;
  }
}
