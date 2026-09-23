import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { SetWorkingHoursDto } from '../customers/dto/set-working-hours.dto';
import type { UpdateAlertThresholdsDto } from './dto/update-alert-thresholds.dto';
import type { UpdateTenantInfoDto } from './dto/update-tenant-info.dto';
import type { UpdateClosingSettingsDto } from './dto/update-closing-settings.dto';

/**
 * Tenant-wide (not per-customer) settings: working hours, alert thresholds,
 * general company info + logo, and the closing/report customization
 * (Configurações > Informações da empresa / Alertas).
 */
@Injectable()
export class TenantSettingsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  getWorkingHours() {
    return this.tenantPrisma.client.tenantWorkingHours.findMany({
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async setWorkingHours(dto: SetWorkingHoursDto) {
    await this.tenantPrisma.client.tenantWorkingHours.deleteMany({});
    if (dto.hours.length > 0) {
      // tenantId is injected at runtime by the tenant-scoped Prisma extension.
      await this.tenantPrisma.client.tenantWorkingHours.createMany({ data: dto.hours as any });
    }
    return this.getWorkingHours();
  }

  // ---------------------------------------------------------------------
  // Tenant info (nome/logo/dados gerais) — Tenant itself isn't in the
  // tenant-scoped allow-list (it IS the tenant), so these go through the
  // raw client id-targeted, same as PlatformController's own tenant edits.
  // ---------------------------------------------------------------------

  getInfo() {
    return this.tenantPrisma.client.tenant.findUniqueOrThrow({ where: { id: this.tenantPrisma.tenantId } });
  }

  updateInfo(dto: UpdateTenantInfoDto) {
    return this.tenantPrisma.client.tenant.update({ where: { id: this.tenantPrisma.tenantId }, data: dto });
  }

  updateLogo(relativePath: string) {
    return this.tenantPrisma.client.tenant.update({ where: { id: this.tenantPrisma.tenantId }, data: { logoUrl: relativePath } });
  }

  // ---------------------------------------------------------------------
  // Alertas > "Alertas de falha na comunicação"
  // ---------------------------------------------------------------------

  async getAlertThresholds() {
    const tenant = await this.tenantPrisma.client.tenant.findUniqueOrThrow({
      where: { id: this.tenantPrisma.tenantId },
      select: { agentOfflineThresholdHours: true, printerOfflineThresholdHours: true },
    });
    return tenant;
  }

  updateAlertThresholds(dto: UpdateAlertThresholdsDto) {
    return this.tenantPrisma.client.tenant.update({
      where: { id: this.tenantPrisma.tenantId },
      data: dto,
      select: { agentOfflineThresholdHours: true, printerOfflineThresholdHours: true },
    });
  }

  // ---------------------------------------------------------------------
  // Informações da empresa > Configurações de relatório / toggles
  // ---------------------------------------------------------------------

  async getClosingSettings() {
    const settings = await this.tenantPrisma.client.tenantClosingSettings.findFirst({});
    return (
      settings ?? {
        allowDisablingPrinterMonitoring: false,
        allowEditingClosingDocumentNumber: false,
        hideUnknownLevelSupplies: false,
        hideNonTonerSupplies: false,
        closingReportTitle: 'Relatório de Fechamento',
        closingReportColumns: {},
        printUsageReportColumns: {},
        additionalText: null,
      }
    );
  }

  async updateClosingSettings(dto: UpdateClosingSettingsDto) {
    const existing = await this.tenantPrisma.client.tenantClosingSettings.findFirst({});
    if (existing) {
      return this.tenantPrisma.client.tenantClosingSettings.update({ where: { id: existing.id }, data: dto as any });
    }
    return this.tenantPrisma.client.tenantClosingSettings.create({ data: dto as any });
  }
}
