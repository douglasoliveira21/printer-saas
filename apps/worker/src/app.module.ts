import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { PrismaService } from './prisma/prisma.service';
import { MonitoringProcessor, MONITORING_QUEUE } from './jobs/monitoring.processor';
import { BillingProcessor, BILLING_QUEUE } from './jobs/billing.processor';
import { ClosingDigestProcessor, NOTIFICATIONS_QUEUE } from './jobs/closing-digest.processor';
import { MailerService } from './mailer/mailer.service';
import { SecretCryptoService } from './common/secret-crypto.service';
import { ReportDeliveryProcessor, REPORTS_QUEUE } from './jobs/report-delivery.processor';
import { SchedulerService } from './scheduler.service';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: new Redis(config.getOrThrow<string>('REDIS_URL'), { maxRetriesPerRequest: null }),
      }),
    }),
    BullModule.registerQueue({ name: MONITORING_QUEUE }, { name: BILLING_QUEUE }, { name: NOTIFICATIONS_QUEUE }, { name: REPORTS_QUEUE }),
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    MonitoringProcessor,
    BillingProcessor,
    ClosingDigestProcessor,
    ReportDeliveryProcessor,
    MailerService,
    SecretCryptoService,
    SchedulerService,
  ],
})
export class AppModule {}
