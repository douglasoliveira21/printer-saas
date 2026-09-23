import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import type { UpdateReportDeliveryDto } from './dto/update-report-delivery.dto';

const REPORT_TYPES = ['PRINTER_USAGE', 'CLOSING_DIGEST', 'PRINTER_USAGE_WITH_COPIES'] as const;

/**
 * Who receives each report type — all customers or a specific list, using
 * an e-mail already registered on the Customer record (never a free-typed
 * address). See apps/worker/src/jobs/report-delivery.processor.ts for the
 * actual generation+send.
 */
@Injectable()
export class ReportDeliveriesService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findAll() {
    const rows = await this.tenantPrisma.client.reportDelivery.findMany({
      include: { customers: { include: { customer: { select: { id: true, legalName: true, tradeName: true } } } } },
    });
    const byType = new Map(rows.map((r) => [r.reportType, r]));

    return REPORT_TYPES.map((reportType) => {
      const row = byType.get(reportType);
      return {
        reportType,
        allCustomers: row?.allCustomers ?? true,
        emailField: row?.emailField ?? 'EMAIL',
        customers: row?.customers.map((c) => c.customer) ?? [],
      };
    });
  }

  async update(reportType: (typeof REPORT_TYPES)[number], dto: UpdateReportDeliveryDto) {
    const existing = await this.tenantPrisma.client.reportDelivery.findFirst({ where: { reportType } });

    const delivery = existing
      ? await this.tenantPrisma.client.reportDelivery.update({
          where: { id: existing.id },
          data: { allCustomers: dto.allCustomers, emailField: dto.emailField },
        })
      : await this.tenantPrisma.client.reportDelivery.create({
          data: { reportType, allCustomers: dto.allCustomers ?? true, emailField: dto.emailField ?? 'EMAIL' } as any,
        });

    if (dto.customerIds) {
      await this.tenantPrisma.client.reportDeliveryCustomer.deleteMany({ where: { deliveryId: delivery.id } });
      if (dto.customerIds.length > 0) {
        await this.tenantPrisma.client.reportDeliveryCustomer.createMany({
          data: dto.customerIds.map((customerId) => ({ deliveryId: delivery.id, customerId })) as any,
        });
      }
    }

    const [updated] = await this.findAll().then((all) => all.filter((d) => d.reportType === reportType));
    return updated;
  }
}
