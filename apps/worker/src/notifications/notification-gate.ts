import { PrismaService } from '../prisma/prisma.service';

export type NotificationType = 'TICKET_ASSIGNED' | 'TICKET_SLA_EXPIRING' | 'TICKET_SLA_BREACHED' | 'TICKET_CLOSED' | 'TICKET_COMMENTED';

/**
 * Tenant-level gate (Configurações > E-mail > Notificações,
 * NotificationTypeSetting) layered on top of each user's own opt-in
 * (User.notifyTicket*, already checked by the callers of this function) — a
 * notification only actually sends when BOTH allow it. A type with no row
 * configured defaults to enabled for every customer, so this never silently
 * breaks a tenant that hasn't touched the new settings screen.
 */
export async function isNotificationEnabledForCustomer(
  prisma: PrismaService,
  tenantId: string,
  type: NotificationType,
  customerId: string | null,
): Promise<boolean> {
  const setting = await prisma.notificationTypeSetting.findFirst({
    where: { tenantId, type },
    include: { customers: { select: { customerId: true } } },
  });
  if (!setting) return true;
  if (setting.allCustomers) return true;
  if (!customerId) return false;
  return setting.customers.some((c) => c.customerId === customerId);
}
