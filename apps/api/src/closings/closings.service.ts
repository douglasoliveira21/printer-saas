import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { calculateFranchiseBilling, calculatePeriodUsage } from '@printer-saas/shared';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

interface ClosingLine {
  contractId: string;
  contractNumber: number;
  printerId: string | null;
  printerModel: string | null;
  pagesUsed: number | null;
  franchisePages: number;
  overturnedPages: number | null;
  overageAmount: number | null;
  monthlyFee: number;
  totalAmount: number;
  dataAvailable: boolean;
}

@Injectable()
export class ClosingsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** Generates (or regenerates) a customer's monthly closing from their active contracts — reuses the exact same franchise/overage math as Contract.billingPreview. */
  async generate(customerId: string, year: number, month: number) {
    const customer = await this.tenantPrisma.client.customer.findFirst({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);

    const contracts = await this.tenantPrisma.client.contract.findMany({
      where: { customerId, status: 'ACTIVE' },
      include: { printer: { select: { id: true, model: true, ip: true } } },
    });

    const lines: ClosingLine[] = [];
    for (const contract of contracts) {
      const monthlyFee = Number(contract.monthlyFee);

      if (!contract.printerId) {
        // No printer to measure usage against — bills the flat fee only.
        lines.push({
          contractId: contract.id,
          contractNumber: contract.number,
          printerId: null,
          printerModel: null,
          pagesUsed: null,
          franchisePages: contract.franchisePages,
          overturnedPages: null,
          overageAmount: null,
          monthlyFee,
          totalAmount: monthlyFee,
          dataAvailable: true,
        });
        continue;
      }

      const readings = await this.tenantPrisma.client.counterReading.findMany({
        where: { printerId: contract.printerId, collectedAt: { gte: from, lte: to } },
        orderBy: { collectedAt: 'asc' },
      });
      const usage = calculatePeriodUsage(readings, 'total', from, to);
      const billing = calculateFranchiseBilling({
        franchisePages: contract.franchisePages,
        monthlyFee,
        overagePricePerPage: Number(contract.overagePriceBw),
        usage,
      });

      lines.push({
        contractId: contract.id,
        contractNumber: contract.number,
        printerId: contract.printerId,
        printerModel: contract.printer?.model ?? contract.printer?.ip ?? null,
        pagesUsed: billing.pagesUsed,
        franchisePages: contract.franchisePages,
        overturnedPages: billing.overturnedPages,
        overageAmount: billing.overageAmount,
        monthlyFee,
        totalAmount: billing.dataAvailable ? billing.totalAmount! : monthlyFee,
        dataAvailable: billing.dataAvailable,
      });
    }

    const totalAmount = lines.reduce((sum, l) => sum + l.totalAmount, 0);

    return this.tenantPrisma.client.monthlyClosing.upsert({
      where: { tenantId_customerId_referenceYear_referenceMonth: { tenantId: this.tenantPrisma.tenantId, customerId, referenceYear: year, referenceMonth: month } },
      update: { totalAmount, details: lines as any, generatedAt: new Date() },
      create: { customerId, referenceYear: year, referenceMonth: month, totalAmount, details: lines as any } as any,
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
    const lines = closing.details as unknown as ClosingLine[];

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

    doc.fontSize(12).text('Detalhamento por impressora', { underline: true });
    doc.moveDown(0.5);
    for (const line of lines) {
      doc.fontSize(10).text(
        `Contrato #${line.contractNumber} — ${line.printerModel ?? 'Sem impressora vinculada'}\n` +
          `  Páginas usadas: ${line.pagesUsed ?? 'Não disponível'} | Franquia: ${line.franchisePages} | Excedente: ${line.overturnedPages ?? '-'}\n` +
          `  Mensalidade: R$ ${line.monthlyFee.toFixed(2)} | Excedente: R$ ${(line.overageAmount ?? 0).toFixed(2)} | Total: R$ ${line.totalAmount.toFixed(2)}`,
      );
      doc.moveDown(0.5);
    }

    doc.moveDown();
    doc.fontSize(14).text(`Total do fechamento: R$ ${Number(closing.totalAmount).toFixed(2)}`, { align: 'right' });

    doc.end();
    return done;
  }
}
