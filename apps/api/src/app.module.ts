import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { LocationsModule } from './locations/locations.module';
import { AgentsModule } from './agents/agents.module';
import { PrintersModule } from './printers/printers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AlertsModule } from './alerts/alerts.module';
import { ServiceOrdersModule } from './service-orders/service-orders.module';
import { ContractsModule } from './contracts/contracts.module';
import { FinancialModule } from './financial/financial.module';
import { InventoryModule } from './inventory/inventory.module';
import { ConsumablesModule } from './consumables/consumables.module';
import { ClosingsModule } from './closings/closings.module';
import { ReportsModule } from './reports/reports.module';
import { PortalModule } from './portal/portal.module';
import { PlatformModule } from './platform/platform.module';
import { RolesModule } from './roles/roles.module';
import { TenantSettingsModule } from './tenant-settings/tenant-settings.module';
import { SnmpCredentialsModule } from './snmp-credentials/snmp-credentials.module';
import { ReportEmailRecipientsModule } from './settings/report-email-recipients/report-email-recipients.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 300 }],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    LocationsModule,
    AgentsModule,
    PrintersModule,
    DashboardModule,
    AlertsModule,
    ServiceOrdersModule,
    ContractsModule,
    FinancialModule,
    InventoryModule,
    ConsumablesModule,
    ClosingsModule,
    ReportsModule,
    PortalModule,
    PlatformModule,
    RolesModule,
    TenantSettingsModule,
    SnmpCredentialsModule,
    ReportEmailRecipientsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
