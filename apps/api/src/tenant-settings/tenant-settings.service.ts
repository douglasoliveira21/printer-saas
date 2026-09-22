import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { SetWorkingHoursDto } from '../customers/dto/set-working-hours.dto';

/**
 * Tenant-wide (not per-customer) settings. Currently just the company's own
 * working hours, used by customers whose SLA mode is
 * BUSINESS_HOURS_COMPANY — same shape/pattern as CustomerWorkingHours, just
 * one set per tenant instead of one per customer.
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
}
