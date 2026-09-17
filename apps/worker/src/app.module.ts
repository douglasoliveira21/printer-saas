import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { PrismaService } from './prisma/prisma.service';
import { MonitoringProcessor, MONITORING_QUEUE } from './jobs/monitoring.processor';
import { BillingProcessor, BILLING_QUEUE } from './jobs/billing.processor';
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
    BullModule.registerQueue({ name: MONITORING_QUEUE }, { name: BILLING_QUEUE }),
  ],
  controllers: [HealthController],
  providers: [PrismaService, MonitoringProcessor, BillingProcessor, SchedulerService],
})
export class AppModule {}
