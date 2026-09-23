import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { calculatePeriodUsage, computeContractPageCost, type TieredBillingBreakdownItem } from '@printer-saas/shared';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

interface PrinterLine {
  printerId: string;
  printerModel: string | null;
  // Identificação, pra "Configurações de relatório" (Configurações >
  // Informações da empresa) — só as colunas com dado real hoje.
  printerSerial: string | null;
  printerIp: string | null;
  printerMac: string | null;
  printerLocation: string | null;
  printerDepartment: string | null;
  pagesBw: number | null;
  pagesColor: number | null;
  pagesScan: number | null;
  priceBw: number;
  priceColor: number;
  priceScan: number;
  fixedCost: number;
  /** Only meaningful when the contract's pageCost.mode is 'FLAT' — otherwise page cost is billed at the contract level (see ContractLine.pageCost). */
  lineTotal: number;
  dataAvailable: boolean;
}

interface ContractLine {
  contractId: string;
  contractNumber: number;
  monthlyFee: number;
  fixedCosts: { label: string; amount: number }[];
  printers: PrinterLine[];
  pageCost: { mode: 'TIERED' | 'FRANCHISE' | 'FLAT'; amount: number; breakdown: TieredBillingBreakdownItem[] };
  contractTotal: number;
  notes: string | null;
}

@Injectable()
export class ClosingsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /**
   * Generates (or regenerates) a customer's monthly closing from their
   * active contracts. Each contract picks its page-cost model in priority
   * order — tiered pricing (ContractPricingTier) > franchise+overage
   * (franchisePages) > flat per-page cost (ContractPrinter/default price) —
   * see computeContractPageCost in packages/shared/src/billing.ts.
   *
   * Refuses to overwrite a FROZEN closing — call unfreeze() first if the
   * numbers genuinely need correcting.
   */
  async generate(customerId: string, year: number, month: number) {
    const customer = await this.tenantPrisma.client.customer.findFirst({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const existing = await this.tenantPrisma.client.monthlyClosing.findFirst({
      where: { customerId, referenceYear: year, referenceMonth: month },
    });
    if (existing?.status === 'FROZEN') {
      throw new ConflictException('Este fechamento está congelado — descongele antes de gerar novamente.');
    }

    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);

    const contracts = await this.tenantPrisma.client.contract.findMany({
      where: { customerId, status: 'ACTIVE' },
      include: {
        fixedCosts: true,
        pricingTiers: true,
        contractPrinters: {
          include: {
            printer: {
              select: { id: true, model: true, ip: true, serial: true, mac: true, location: { select: { name: true } }, department: { select: { name: true } } },
            },
          },
        },
      },
    });

    const contractLines: ContractLine[] = [];
    for (const contract of contracts) {
      const monthlyFee = Number(contract.monthlyFee);
      const fixedCosts = contract.fixedCosts.map((c) => ({ label: c.label, amount: Number(c.amount) }));
      const pricingTiers = contract.pricingTiers.map((t) => ({
        fromPage: t.fromPage,
        toPage: t.toPage,
        pricePerPage: Number(t.pricePerPage),
      }));

      const printerLines: PrinterLine[] = [];
      let totalPagesUsed: number | null = pricingTiers.length > 0 || contract.franchisePages > 0 ? 0 : null;
      let anyUsageData = false;

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
        if (dataAvailable) {
          anyUsageData = true;
          if (totalPagesUsed !== null) {
            totalPagesUsed += (bw.pagesUsed ?? 0) + (color.pagesUsed ?? 0) + (scan.pagesUsed ?? 0);
          }
        }

        const lineTotal = fixedCost + (bw.pagesUsed ?? 0) * priceBw + (color.pagesUsed ?? 0) * priceColor + (scan.pagesUsed ?? 0) * priceScan;

        printerLines.push({
          printerId: cp.printerId,
          printerModel: cp.printer.model ?? cp.printer.ip ?? null,
          printerSerial: cp.printer.serial ?? null,
          printerIp: cp.printer.ip ?? null,
          printerMac: cp.printer.mac ?? null,
          printerLocation: cp.printer.location?.name ?? null,
          printerDepartment: cp.printer.department?.name ?? null,
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

      const pageCostResult = computeContractPageCost({
        totalPagesUsed: anyUsageData ? totalPagesUsed : null,
        pricingTiers,
        franchisePages: contract.franchisePages,
        overagePricePerPage: Number(contract.overagePriceBw),
      });

      const pageCost = {
        mode: pageCostResult.mode,
        amount: pageCostResult.mode === 'FLAT' ? printerLines.reduce((s, p) => s + (p.lineTotal - p.fixedCost), 0) : pageCostResult.amount ?? 0,
        breakdown: pageCostResult.breakdown,
      };

      const printersFixedCostSum = printerLines.reduce((s, p) => s + p.fixedCost, 0);
      const contractTotal =
        monthlyFee +
        fixedCosts.reduce((s, c) => s + c.amount, 0) +
        printersFixedCostSum +
        (pageCostResult.mode === 'FLAT' ? printerLines.reduce((s, p) => s + (p.lineTotal - p.fixedCost), 0) : pageCost.amount);

      contractLines.push({
        contractId: contract.id,
        contractNumber: contract.number,
        monthlyFee,
        fixedCosts,
        printers: printerLines,
        pageCost,
        contractTotal: Math.round(contractTotal * 100) / 100,
        notes: contract.printNotesOnClosing ? contract.notes : null,
      });
    }

    const totalAmount = contractLines.reduce((sum, c) => sum + c.contractTotal, 0);

    return this.tenantPrisma.client.monthlyClosing.upsert({
      where: { tenantId_customerId_referenceYear_referenceMonth: { tenantId: this.tenantPrisma.tenantId, customerId, referenceYear: year, referenceMonth: month } },
      update: { totalAmount, details: contractLines as any, generatedAt: new Date(), status: 'PENDING', frozenAt: null },
      create: { customerId, referenceYear: year, referenceMonth: month, totalAmount, details: contractLines as any } as any,
    });
  }

  async freeze(id: string) {
    const closing = await this.findOne(id);
    if (closing.status === 'FROZEN') {
      return closing;
    }
    return this.tenantPrisma.client.monthlyClosing.update({
      where: { id },
      data: { status: 'FROZEN', frozenAt: new Date() },
    });
  }

  async unfreeze(id: string) {
    await this.findOne(id);
    return this.tenantPrisma.client.monthlyClosing.update({
      where: { id },
      data: { status: 'PENDING', frozenAt: null },
    });
  }

  /** Only allowed when TenantClosingSettings.allowEditingClosingDocumentNumber is on (Configurações > Informações da empresa). */
  async updateDocumentNumber(id: string, documentNumber: string | null) {
    await this.findOne(id);
    const settings = await this.tenantPrisma.client.tenantClosingSettings.findFirst({});
    if (!settings?.allowEditingClosingDocumentNumber) {
      throw new ConflictException('Edição do número do documento não está habilitada em Configurações > Informações da empresa.');
    }
    return this.tenantPrisma.client.monthlyClosing.update({ where: { id }, data: { documentNumber } });
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
    const settings = await this.tenantPrisma.client.tenantClosingSettings.findFirst({});
    // Só as chaves com dado real hoje têm efeito — ver o comentário do
    // TenantClosingSettings no schema. O resto do que a UI de Configurações
    // permite marcar fica guardado sem gerar coluna nenhuma aqui.
    const columns = (settings?.closingReportColumns as Record<string, boolean> | undefined) ?? {};

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const customerName = closing.customer.tradeName || closing.customer.legalName;
    doc.fontSize(18).text(settings?.closingReportTitle || 'Relatório de Fechamento', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Cliente: ${customerName}`);
    doc.text(`Período: ${String(closing.referenceMonth).padStart(2, '0')}/${closing.referenceYear}`);
    if (closing.documentNumber) doc.text(`Documento nº: ${closing.documentNumber}`);
    doc.text(`Status: ${closing.status === 'FROZEN' ? 'Congelado' : 'Pendente'}`);
    doc.text(`Gerado em: ${closing.generatedAt.toLocaleString('pt-BR')}`);
    doc.moveDown();

    for (const contract of contractLines) {
      doc.fontSize(12).text(`Contrato #${contract.contractNumber} — Mensalidade: R$ ${contract.monthlyFee.toFixed(2)}`, { underline: true });
      doc.moveDown(0.3);
      for (const p of contract.printers) {
        const idBits: string[] = [];
        if (columns.id_serial && p.printerSerial) idBits.push(`Série: ${p.printerSerial}`);
        if (columns.id_ip && p.printerIp) idBits.push(`IP: ${p.printerIp}`);
        if (columns.id_mac && p.printerMac) idBits.push(`MAC: ${p.printerMac}`);
        if (columns.id_location && p.printerLocation) idBits.push(`Local: ${p.printerLocation}`);
        if (columns.id_department && p.printerDepartment) idBits.push(`Depto: ${p.printerDepartment}`);

        const counterBits: string[] = [];
        if (columns.counter_bw !== false) counterBits.push(`P&B: ${p.pagesBw ?? 'Não disponível'}`);
        if (columns.counter_color !== false) counterBits.push(`Colorida: ${p.pagesColor ?? 'Não disponível'}`);
        if (columns.counter_scan !== false) counterBits.push(`Digitalização: ${p.pagesScan ?? 'Não disponível'}`);

        doc.fontSize(10).text(
          `${p.printerModel ?? p.printerId}${idBits.length ? ` (${idBits.join(' | ')})` : ''}\n` +
            `  ${counterBits.join(' | ')}` +
            (columns.other_fixedCost !== false ? `\n  Custo fixo: R$ ${p.fixedCost.toFixed(2)}` : ''),
        );
        doc.moveDown(0.3);
      }
      const pageCostLabel = { TIERED: 'Faixas de páginas', FRANCHISE: 'Franquia + excedente', FLAT: 'Custo por página' }[contract.pageCost.mode];
      doc.fontSize(10).text(`Custo de páginas (${pageCostLabel}): R$ ${contract.pageCost.amount.toFixed(2)}`);
      for (const fc of contract.fixedCosts) {
        doc.fontSize(10).text(`Custo adicional — ${fc.label}: R$ ${fc.amount.toFixed(2)}`);
      }
      if (contract.notes) {
        doc.moveDown(0.3);
        doc.fontSize(10).text(`Observação: ${contract.notes}`);
      }
      doc.fontSize(11).text(`Total do contrato: R$ ${contract.contractTotal.toFixed(2)}`, { align: 'right' });
      doc.moveDown();
    }

    doc.moveDown();
    doc.fontSize(14).text(`Total do fechamento: R$ ${Number(closing.totalAmount).toFixed(2)}`, { align: 'right' });

    if (settings?.additionalText) {
      doc.moveDown();
      doc.fontSize(9).fillColor('gray').text(settings.additionalText);
      doc.fillColor('black');
    }

    doc.end();
    return done;
  }
}
