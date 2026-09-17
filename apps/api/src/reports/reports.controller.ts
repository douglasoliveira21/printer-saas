import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { toCsv } from './csv.util';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private respond(res: Response, filename: string, format: string | undefined, data: Record<string, unknown>[], columns: { key: string; header: string }[]) {
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(toCsv(data, columns));
      return;
    }
    res.json(data);
  }

  @Get('printers-usage')
  @RequirePermissions('reports.view')
  async printersUsage(@Query() query: DateRangeQueryDto, @Res() res: Response) {
    const data = await this.reportsService.printersUsage(query.from, query.to);
    this.respond(res, 'impressoes-por-equipamento', query.format, data, [
      { key: 'customer', header: 'Cliente' },
      { key: 'manufacturer', header: 'Fabricante' },
      { key: 'model', header: 'Modelo' },
      { key: 'serial', header: 'Serial' },
      { key: 'totalPages', header: 'Total de páginas' },
      { key: 'blackWhitePages', header: 'P&B' },
      { key: 'colorPages', header: 'Colorido' },
    ]);
  }

  @Get('service-orders')
  @RequirePermissions('reports.view')
  async serviceOrders(@Query() query: DateRangeQueryDto & { status?: string }, @Res() res: Response) {
    const data = await this.reportsService.serviceOrders(query.from, query.to, query.status);
    this.respond(res, 'ordens-de-servico', query.format, data, [
      { key: 'number', header: 'Número' },
      { key: 'customer', header: 'Cliente' },
      { key: 'technician', header: 'Técnico' },
      { key: 'priority', header: 'Prioridade' },
      { key: 'status', header: 'Status' },
      { key: 'createdAt', header: 'Aberta em' },
      { key: 'completedAt', header: 'Concluída em' },
      { key: 'late', header: 'Atrasada' },
    ]);
  }

  @Get('financial')
  @RequirePermissions('reports.view')
  async financial(@Query() query: DateRangeQueryDto & { type?: string }, @Res() res: Response) {
    const data = await this.reportsService.financial(query.from, query.to, query.type);
    this.respond(res, 'financeiro', query.format, data, [
      { key: 'type', header: 'Tipo' },
      { key: 'category', header: 'Categoria' },
      { key: 'customer', header: 'Cliente' },
      { key: 'description', header: 'Descrição' },
      { key: 'amount', header: 'Valor' },
      { key: 'dueDate', header: 'Vencimento' },
      { key: 'status', header: 'Status' },
    ]);
  }

  @Get('printers-offline')
  @RequirePermissions('reports.view')
  async printersOffline(@Query('format') format: string | undefined, @Res() res: Response) {
    const data = await this.reportsService.offlinePrinters();
    this.respond(res, 'impressoras-offline', format, data, [
      { key: 'customer', header: 'Cliente' },
      { key: 'location', header: 'Local' },
      { key: 'manufacturer', header: 'Fabricante' },
      { key: 'model', header: 'Modelo' },
      { key: 'ip', header: 'IP' },
      { key: 'lastSeenAt', header: 'Visto por último' },
    ]);
  }

  @Get('contracts-expiring')
  @RequirePermissions('reports.view')
  async contractsExpiring(@Query('days') days: string | undefined, @Query('format') format: string | undefined, @Res() res: Response) {
    const data = await this.reportsService.contractsExpiring(days ? Number(days) : undefined);
    this.respond(res, 'contratos-vencendo', format, data, [
      { key: 'number', header: 'Contrato' },
      { key: 'customer', header: 'Cliente' },
      { key: 'endDate', header: 'Vencimento' },
      { key: 'monthlyFee', header: 'Mensalidade' },
    ]);
  }
}
