import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import type { CreatePrinterErrorCodeDto, UpdatePrinterErrorCodeDto } from './dto/printer-error-code.dto';

/**
 * Reference-only catalog for now — see PrinterErrorCodeCatalog's schema
 * comment. Nothing in the Agent/API pipeline reports a raw manufacturer
 * error code yet, so this doesn't auto-fire alerts; it's a manual lookup
 * table staff maintain themselves.
 */
@Injectable()
export class PrinterErrorCodesService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  findAll() {
    return this.tenantPrisma.client.printerErrorCodeCatalog.findMany({ orderBy: [{ manufacturer: 'asc' }, { code: 'asc' }] });
  }

  create(dto: CreatePrinterErrorCodeDto) {
    return this.tenantPrisma.client.printerErrorCodeCatalog.create({ data: dto as any });
  }

  async update(id: string, dto: UpdatePrinterErrorCodeDto) {
    await this.assertExists(id);
    return this.tenantPrisma.client.printerErrorCodeCatalog.update({ where: { id }, data: dto as any });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.tenantPrisma.client.printerErrorCodeCatalog.delete({ where: { id } });
    return { removed: true };
  }

  private async assertExists(id: string) {
    const entry = await this.tenantPrisma.client.printerErrorCodeCatalog.findFirst({ where: { id } });
    if (!entry) {
      throw new NotFoundException('Código de erro não encontrado');
    }
  }
}
