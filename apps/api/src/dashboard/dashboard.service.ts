import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async summary() {
    const client = this.tenantPrisma.client;
    const [printersMonitored, printersOnline, printersOffline, alertsCritical, alertsWarning, contractsActive, serviceOrdersOpen, serviceOrdersLate] =
      await Promise.all([
        client.printer.count({ where: { status: 'MONITORED' } }),
        client.printer.count({ where: { status: 'MONITORED', onlineStatus: 'ONLINE' } }),
        client.printer.count({ where: { status: 'MONITORED', onlineStatus: 'OFFLINE' } }),
        client.alert.count({ where: { status: 'OPEN', level: 'CRITICAL' } }),
        client.alert.count({ where: { status: 'OPEN', level: 'WARNING' } }),
        client.contract.count({ where: { status: 'ACTIVE' } }),
        client.serviceOrder.count({ where: { status: { in: ['OPEN', 'SCHEDULED', 'IN_PROGRESS'] } } }),
        client.serviceOrder.count({ where: { status: { notIn: ['DONE', 'CANCELLED'] }, slaDueAt: { lt: new Date() } } }),
      ]);

    return {
      printers: {
        monitored: printersMonitored,
        online: printersOnline,
        offline: printersOffline,
        onlinePercent: printersMonitored > 0 ? Math.round((printersOnline / printersMonitored) * 1000) / 10 : 0,
      },
      alerts: { critical: alertsCritical, warning: alertsWarning },
      contracts: { active: contractsActive },
      serviceOrders: { open: serviceOrdersOpen, late: serviceOrdersLate },
    };
  }
}
