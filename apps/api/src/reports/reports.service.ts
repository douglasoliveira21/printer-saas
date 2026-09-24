import { Injectable, NotFoundException } from '@nestjs/common';
import { calculatePeriodUsage } from '@printer-saas/shared';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { createReportPdf, type ReportTenant } from '../common/pdf/report-pdf.util';

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

  private async tenantForPdf(): Promise<ReportTenant | null> {
    const tenant = await this.tenantPrisma.client.tenant.findUnique({ where: { id: this.tenantPrisma.tenantId } });
    if (!tenant) return null;
    return {
      name: tenant.name,
      legalName: tenant.legalName,
      document: tenant.document,
      address: tenant.address,
      phone: tenant.phone,
      email: tenant.email,
      logoUrl: tenant.logoUrl,
    };
  }

  /**
   * Shared by "Impressões e cópias por impressora" and "Digitalizações por
   * impressora" (Relatórios) — mesma estrutura de filtro (cliente + contrato
   * + período) e mesmo layout, só muda qual contador é somado. "Scan" usa o
   * campo `copies` do CounterReading — mesma convenção já usada em
   * ClosingsService.generatePdf pra "Digitalização" (o Agent não distingue
   * cópia de digitalização hoje, ambas chegam nesse contador).
   */
  private async printerUsageReportPdf(params: {
    customerId: string;
    contractId?: string;
    from?: string;
    to?: string;
    field: 'total' | 'copies';
    reportTitle: string;
    columnLabel: string;
  }) {
    const { fromDate, toDate } = defaultRange(params.from, params.to);
    const customer = await this.tenantPrisma.client.customer.findFirst({ where: { id: params.customerId } });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    let contract: { id: string; number: number } | null = null;
    let printerIds: string[] | null = null;
    if (params.contractId) {
      contract = await this.tenantPrisma.client.contract.findFirst({
        where: { id: params.contractId, customerId: params.customerId },
        select: { id: true, number: true },
      });
      if (!contract) throw new NotFoundException('Contrato não encontrado para este cliente');
      const contractPrinters = await this.tenantPrisma.client.contractPrinter.findMany({
        where: { contractId: contract.id },
        select: { printerId: true },
      });
      printerIds = contractPrinters.map((cp) => cp.printerId);
    }

    const printers = await this.tenantPrisma.client.printer.findMany({
      where: { customerId: params.customerId, ...(printerIds ? { id: { in: printerIds } } : {}) },
      include: { counters: { where: { collectedAt: { gte: fromDate, lte: toDate } }, orderBy: { collectedAt: 'asc' } } },
      orderBy: { model: 'asc' },
    });

    const customerName = customer.tradeName || customer.legalName;
    const subtitleParts = [customerName, contract ? `Contrato #${contract.number}` : null, `${fromDate.toLocaleDateString('pt-BR')} a ${toDate.toLocaleDateString('pt-BR')}`];
    const pdf = createReportPdf(await this.tenantForPdf(), params.reportTitle, subtitleParts.filter(Boolean).join(' — '));

    const rows = printers.map((p) => {
      const usage = calculatePeriodUsage(p.counters, params.field, fromDate, toDate);
      return [
        p.manufacturer ?? '—',
        p.model ?? '—',
        p.serial ?? '—',
        p.ip ?? '—',
        usage.pagesUsed !== null ? String(usage.pagesUsed) : 'Não disponível',
      ];
    });
    const total = rows.reduce((sum, r) => sum + (Number(r[4]) || 0), 0);

    pdf.section('Impressoras');
    if (rows.length > 0) {
      pdf.gridTable(
        ['Fabricante', 'Modelo', 'Série', 'IP', params.columnLabel],
        [180, 180, 140, 120, 120],
        rows,
      );
    } else {
      pdf.field('', 'Nenhuma impressora encontrada para este filtro.');
    }
    pdf.field('Total do período', String(total));

    return pdf.end();
  }

  async printersUsagePdf(params: { customerId: string; contractId?: string; from?: string; to?: string }) {
    return this.printerUsageReportPdf({ ...params, field: 'total', reportTitle: 'Impressões e cópias por impressora', columnLabel: 'Páginas' });
  }

  async scansUsagePdf(params: { customerId: string; contractId?: string; from?: string; to?: string }) {
    return this.printerUsageReportPdf({ ...params, field: 'copies', reportTitle: 'Digitalizações por impressora', columnLabel: 'Digitalizações' });
  }

  /** "Totais por cliente" — só o período, um total por cliente, sem entrar em detalhe de impressora. */
  async totalsByCustomerPdf(from?: string, to?: string) {
    const { fromDate, toDate } = defaultRange(from, to);
    const customers = await this.tenantPrisma.client.customer.findMany({
      where: { status: 'ACTIVE' },
      include: { printers: { include: { counters: { where: { collectedAt: { gte: fromDate, lte: toDate } }, orderBy: { collectedAt: 'asc' } } } } },
      orderBy: { legalName: 'asc' },
    });

    const pdf = createReportPdf(
      await this.tenantForPdf(),
      'Totais por cliente',
      `${fromDate.toLocaleDateString('pt-BR')} a ${toDate.toLocaleDateString('pt-BR')}`,
    );

    const rows = customers.map((customer) => {
      let total = 0;
      let bw = 0;
      let color = 0;
      let hasData = false;
      for (const printer of customer.printers) {
        const t = calculatePeriodUsage(printer.counters, 'total', fromDate, toDate);
        const b = calculatePeriodUsage(printer.counters, 'blackWhite', fromDate, toDate);
        const c = calculatePeriodUsage(printer.counters, 'color', fromDate, toDate);
        if (t.pagesUsed !== null) {
          hasData = true;
          total += t.pagesUsed;
        }
        if (b.pagesUsed !== null) bw += b.pagesUsed;
        if (c.pagesUsed !== null) color += c.pagesUsed;
      }
      return {
        name: customer.tradeName || customer.legalName,
        printerCount: customer.printers.length,
        total: hasData ? total : null,
        bw,
        color,
      };
    });

    pdf.section('Clientes');
    pdf.gridTable(
      ['Cliente', 'Impressoras', 'P&B', 'Colorido', 'Total'],
      [260, 120, 120, 120, 120],
      rows.map((r) => [r.name, String(r.printerCount), String(r.bw), String(r.color), r.total !== null ? String(r.total) : 'Não disponível']),
    );
    const grandTotal = rows.reduce((sum, r) => sum + (r.total ?? 0), 0);
    pdf.field('Total geral do período', String(grandTotal));

    return pdf.end();
  }

  /**
   * Relatório de chamados — um bloco por OS, só com os campos/grupos que o
   * chamador marcou (ver SERVICE_ORDER_REPORT_COLUMNS no controller pro
   * catálogo completo). Algumas colunas pedidas não têm dado real hoje
   * (desconto do chamado, patrimônio da impressora, tempo/datas/observação
   * por serviço individual, origem/destino de itens de estoque, observação
   * de custo adicional, comentários da OS — não existe esse recurso ainda)
   * — aparecem como "Não disponível" em vez de inventadas (spec §67).
   */
  async serviceOrdersDetailedPdf(params: { from?: string; to?: string; customerId?: string; columns: string[] }) {
    const { fromDate, toDate } = defaultRange(params.from, params.to);
    const cols = new Set(params.columns);
    const has = (k: string) => cols.has(k);

    const orders = await this.tenantPrisma.client.serviceOrder.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
        ...(params.customerId ? { customerId: params.customerId } : {}),
      },
      include: {
        customer: true,
        location: true,
        printer: { include: { location: true, department: true } },
        technician: { select: { name: true } },
        createdBy: { select: { name: true } },
        serviceOrderTypeCatalog: { select: { name: true } },
        parts: true,
        alerts: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const pdf = createReportPdf(
      await this.tenantForPdf(),
      'Relatório de chamados',
      `${fromDate.toLocaleDateString('pt-BR')} a ${toDate.toLocaleDateString('pt-BR')}`,
    );

    const na = 'Não disponível';
    const fmtDate = (d: Date | null) => (d ? d.toLocaleString('pt-BR') : '—');
    const fmtDuration = (fromD: Date | null, toD: Date | null) => {
      if (!fromD || !toD) return '—';
      const minutes = Math.round((toD.getTime() - fromD.getTime()) / 60000);
      return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}min`;
    };

    for (const order of orders) {
      const customerName = order.customer?.tradeName || order.customer?.legalName || '—';
      pdf.section(`OS #${order.number}${order.title ? ' — ' + order.title : ''}`);

      // Chamados
      if (has('number')) pdf.field('Nº do chamado', String(order.number));
      if (has('status')) pdf.field('Situação', order.status);
      if (has('createdBy')) pdf.field('Criado por', order.createdBy?.name ?? '—');
      if (has('technician')) pdf.field('Responsável', order.technician?.name ?? 'Não atribuído');
      if (has('customer')) pdf.field('Cliente', customerName);
      if (has('title')) pdf.field('Título', order.title ?? '—');
      if (has('serviceType')) pdf.field('Tipo de chamado', order.serviceOrderTypeCatalog?.name ?? '—');
      if (has('attendanceStart')) pdf.field('Início do atendimento', fmtDate(order.arrivedAt));
      if (has('attendanceEnd')) pdf.field('Fim do atendimento', fmtDate(order.departedAt));
      if (has('attendanceDuration')) pdf.field('Tempo de atendimento', fmtDuration(order.arrivedAt, order.departedAt));
      if (has('createdAt')) pdf.field('Data de abertura', fmtDate(order.createdAt));
      if (has('completedAt')) pdf.field('Data de encerramento', fmtDate(order.completedAt));
      if (has('openDuration')) pdf.field('Tempo aberto', fmtDuration(order.createdAt, order.completedAt ?? new Date()));
      if (has('priority')) pdf.field('Prioridade', order.priority);
      if (has('description')) pdf.field('Descrição do chamado', order.description ?? '—');
      if (has('discount')) pdf.field('Desconto do chamado', na);
      if (has('value')) {
        const materialsTotal = order.parts.reduce((s, p) => s + p.quantity * Number(p.unitValue), 0);
        const total = materialsTotal + Number(order.laborCost ?? 0) + Number(order.travelCost ?? 0);
        pdf.field('Valor do chamado', `R$ ${total.toFixed(2)}`);
      }

      // SLA
      if (has('slaHours')) pdf.field('SLA do chamado', order.customer?.slaHours ? `${order.customer.slaHours}h` : '—');
      if (has('slaDueAt')) pdf.field('Prazo final de atendimento', fmtDate(order.slaDueAt));
      const slaExceeded = !!order.slaDueAt && (order.completedAt ?? new Date()) > order.slaDueAt;
      if (has('slaExceeded')) pdf.field('SLA excedido?', order.slaDueAt ? (slaExceeded ? 'Sim' : 'Não') : '—');
      if (has('slaExceededTime')) {
        pdf.field('Tempo excedido do SLA', order.slaDueAt && slaExceeded ? fmtDuration(order.slaDueAt, order.completedAt ?? new Date()) : '—');
      }

      // Localização — endereço estruturado só existe no cadastro do
      // cliente hoje (Location guarda só um campo de endereço livre).
      const c = order.customer;
      if (has('locationName')) pdf.field('Identificação da localização', order.location?.name ?? customerName);
      if (has('zipCode')) pdf.field('CEP', c?.zipCode ?? '—');
      if (has('street')) pdf.field('Rua', c?.street ?? '—');
      if (has('addressNumber')) pdf.field('Número', c?.number ?? '—');
      if (has('neighborhood')) pdf.field('Bairro', c?.neighborhood ?? '—');
      if (has('complement')) pdf.field('Complemento', c?.complement ?? '—');
      if (has('state')) pdf.field('Estado', c?.state ?? '—');
      if (has('city')) pdf.field('Cidade', c?.city ?? '—');

      // Impressoras
      const p = order.printer;
      if (has('printer')) pdf.field('Impressora', p ? `${p.manufacturer ?? ''} ${p.model ?? ''}`.trim() || '—' : '—');
      if (has('manufacturer')) pdf.field('Fabricante', p?.manufacturer ?? '—');
      if (has('model')) pdf.field('Modelo', p?.model ?? '—');
      if (has('serial')) pdf.field('Número de série', p?.serial ?? '—');
      if (has('asset')) pdf.field('Nº de patrimônio', na);
      if (has('ip')) pdf.field('Endereço IP', p?.ip ?? '—');
      if (has('mac')) pdf.field('Endereço MAC', p?.mac ?? '—');
      if (has('printerLocation')) pdf.field('Localização da impressora', p?.location?.name ?? '—');
      if (has('department')) pdf.field('Departamento da impressora', p?.department?.name ?? '—');
      if (has('owner')) pdf.field('Proprietário da impressora', customerName);

      // Alertas relacionados
      const alertCols = ['alertType', 'alertLevel', 'alertMessage', 'alertPrinter', 'alertOpenDuration', 'alertCreatedAt', 'alertResolvedAt'];
      if (alertCols.some(has)) {
        if (order.alerts.length > 0) {
          const headers: string[] = ['#'];
          const widths: number[] = [24];
          if (has('alertType')) { headers.push('Tipo'); widths.push(130); }
          if (has('alertLevel')) { headers.push('Nível'); widths.push(80); }
          if (has('alertMessage')) { headers.push('Descrição'); widths.push(260); }
          if (has('alertOpenDuration')) { headers.push('Tempo aberto'); widths.push(100); }
          if (has('alertCreatedAt')) { headers.push('Aberto em'); widths.push(140); }
          if (has('alertResolvedAt')) { headers.push('Encerrado em'); widths.push(140); }
          const rows = order.alerts.map((a, i) => {
            const row = [String(i + 1)];
            if (has('alertType')) row.push(a.type);
            if (has('alertLevel')) row.push(a.level);
            if (has('alertMessage')) row.push(a.message);
            if (has('alertOpenDuration')) row.push(fmtDuration(a.createdAt, a.resolvedAt ?? new Date()));
            if (has('alertCreatedAt')) row.push(fmtDate(a.createdAt));
            if (has('alertResolvedAt')) row.push(fmtDate(a.resolvedAt));
            return row;
          });
          pdf.gridTable(headers, widths, rows);
        } else {
          pdf.field('Alertas', 'Nenhum alerta relacionado');
        }
      }

      // Serviços (peças/serviços lançados na OS — tempo/datas/observação
      // por item individual não são registrados hoje, só no nível da OS)
      const serviceCols = ['serviceName', 'servicePrinter', 'serviceResponsible', 'serviceExecutionTime', 'serviceStart', 'serviceEnd', 'serviceNotes', 'serviceValue'];
      if (serviceCols.some(has)) {
        if (order.parts.length > 0) {
          const headers: string[] = [];
          const widths: number[] = [];
          if (has('serviceName')) { headers.push('Serviço'); widths.push(220); }
          if (has('servicePrinter')) { headers.push('Impressora'); widths.push(160); }
          if (has('serviceResponsible')) { headers.push('Responsável'); widths.push(140); }
          if (has('serviceExecutionTime')) { headers.push('Tempo de execução'); widths.push(100); }
          if (has('serviceStart')) { headers.push('Início'); widths.push(90); }
          if (has('serviceEnd')) { headers.push('Fim'); widths.push(90); }
          if (has('serviceNotes')) { headers.push('Observações'); widths.push(160); }
          if (has('serviceValue')) { headers.push('Valor'); widths.push(90); }
          const rows = order.parts.map((part) => {
            const row: string[] = [];
            if (has('serviceName')) row.push(part.name);
            if (has('servicePrinter')) row.push(p ? `${p.manufacturer ?? ''} ${p.model ?? ''}`.trim() || '—' : '—');
            if (has('serviceResponsible')) row.push(order.technician?.name ?? '—');
            if (has('serviceExecutionTime')) row.push(na);
            if (has('serviceStart')) row.push(na);
            if (has('serviceEnd')) row.push(na);
            if (has('serviceNotes')) row.push(na);
            if (has('serviceValue')) row.push(`R$ ${(part.quantity * Number(part.unitValue)).toFixed(2)}`);
            return row;
          });
          pdf.gridTable(headers, widths, rows);
        } else {
          pdf.field('Serviços', 'Nenhum serviço lançado');
        }
      }

      // Itens do estoque (linhas de peças vinculadas a um item de estoque)
      const stockCols = ['stockItem', 'stockQuantity', 'stockOriginType', 'stockOriginDesc', 'stockDestType', 'stockDestDesc', 'stockNotes', 'stockTotalValue'];
      if (stockCols.some(has)) {
        const stockParts = order.parts.filter((part) => part.inventoryItemId);
        if (stockParts.length > 0) {
          const headers: string[] = [];
          const widths: number[] = [];
          if (has('stockItem')) { headers.push('Item'); widths.push(220); }
          if (has('stockQuantity')) { headers.push('Quantidade'); widths.push(90); }
          if (has('stockOriginType')) { headers.push('Tipo de origem'); widths.push(110); }
          if (has('stockOriginDesc')) { headers.push('Descrição da origem'); widths.push(140); }
          if (has('stockDestType')) { headers.push('Tipo de destino'); widths.push(110); }
          if (has('stockDestDesc')) { headers.push('Descrição do destino'); widths.push(140); }
          if (has('stockNotes')) { headers.push('Observações'); widths.push(140); }
          if (has('stockTotalValue')) { headers.push('Valor total'); widths.push(90); }
          const rows = stockParts.map((part) => {
            const row: string[] = [];
            if (has('stockItem')) row.push(part.name);
            if (has('stockQuantity')) row.push(String(part.quantity));
            if (has('stockOriginType')) row.push(na);
            if (has('stockOriginDesc')) row.push(na);
            if (has('stockDestType')) row.push(na);
            if (has('stockDestDesc')) row.push(na);
            if (has('stockNotes')) row.push(na);
            if (has('stockTotalValue')) row.push(`R$ ${(part.quantity * Number(part.unitValue)).toFixed(2)}`);
            return row;
          });
          pdf.gridTable(headers, widths, rows);
        } else {
          pdf.field('Itens do estoque', 'Nenhum item de estoque lançado');
        }
      }

      // Custos adicionais
      const costCols = ['costDescription', 'costValue', 'costNotes'];
      if (costCols.some(has)) {
        const costs: { desc: string; value: number }[] = [];
        if (Number(order.laborCost ?? 0) > 0) costs.push({ desc: 'Mão de obra', value: Number(order.laborCost) });
        if (Number(order.travelCost ?? 0) > 0) costs.push({ desc: 'Deslocamento', value: Number(order.travelCost) });
        if (costs.length > 0) {
          const headers: string[] = [];
          const widths: number[] = [];
          if (has('costDescription')) { headers.push('Descrição'); widths.push(260); }
          if (has('costValue')) { headers.push('Valor'); widths.push(120); }
          if (has('costNotes')) { headers.push('Observações'); widths.push(260); }
          const rows = costs.map((c2) => {
            const row: string[] = [];
            if (has('costDescription')) row.push(c2.desc);
            if (has('costValue')) row.push(`R$ ${c2.value.toFixed(2)}`);
            if (has('costNotes')) row.push(na);
            return row;
          });
          pdf.gridTable(headers, widths, rows);
        } else {
          pdf.field('Custos adicionais', 'Nenhum custo adicional lançado');
        }
      }

      // Comentários — recurso ainda não existe pra Ordens de Serviço (só pra impressora)
      const commentCols = ['commentText', 'commentAuthor', 'commentDate'];
      if (commentCols.some(has)) {
        pdf.field('Comentários', na);
      }
    }

    if (orders.length === 0) {
      pdf.field('', 'Nenhum chamado encontrado no período selecionado.');
    }

    return pdf.end();
  }
}
