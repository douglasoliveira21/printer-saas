import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import type { UpdateNotificationSettingDto } from './dto/update-notification-setting.dto';

const NOTIFICATION_TYPES = ['TICKET_ASSIGNED', 'TICKET_SLA_EXPIRING', 'TICKET_SLA_BREACHED', 'TICKET_CLOSED', 'TICKET_COMMENTED'] as const;

/**
 * Per-customer gate layered on top of each user's own notifyTicket*
 * preference (User model) — a notification only actually sends when BOTH
 * the target user opted in AND the ticket's customer is in scope here. A
 * type with no row configured defaults to "enabled for every customer", so
 * nothing already working silently stops sending when this feature ships.
 */
@Injectable()
export class NotificationSettingsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async findAll() {
    const rows = await this.tenantPrisma.client.notificationTypeSetting.findMany({
      include: { customers: { include: { customer: { select: { id: true, legalName: true, tradeName: true } } } } },
    });
    const byType = new Map(rows.map((r) => [r.type, r]));

    return NOTIFICATION_TYPES.map((type) => {
      const row = byType.get(type);
      return {
        type,
        allCustomers: row?.allCustomers ?? true,
        customers: row?.customers.map((c) => c.customer) ?? [],
      };
    });
  }

  async update(type: (typeof NOTIFICATION_TYPES)[number], dto: UpdateNotificationSettingDto) {
    const existing = await this.tenantPrisma.client.notificationTypeSetting.findFirst({ where: { type } });

    const setting = existing
      ? await this.tenantPrisma.client.notificationTypeSetting.update({
          where: { id: existing.id },
          data: { allCustomers: dto.allCustomers },
        })
      : await this.tenantPrisma.client.notificationTypeSetting.create({
          data: { type, allCustomers: dto.allCustomers ?? true } as any,
        });

    if (dto.customerIds) {
      await this.tenantPrisma.client.notificationTypeCustomer.deleteMany({ where: { settingId: setting.id } });
      if (dto.customerIds.length > 0) {
        await this.tenantPrisma.client.notificationTypeCustomer.createMany({
          data: dto.customerIds.map((customerId) => ({ settingId: setting.id, customerId })) as any,
        });
      }
    }

    const [updated] = await this.findAll().then((all) => all.filter((s) => s.type === type));
    return updated;
  }
}
