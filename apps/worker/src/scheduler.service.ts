import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { CHECK_OFFLINE_JOB, CHECK_SLA_JOB, CHECK_TONER_JOB, MONITORING_QUEUE } from './jobs/monitoring.processor';
import { BILLING_QUEUE, GENERATE_MONTHLY_CHARGES_JOB } from './jobs/billing.processor';
import { NOTIFICATIONS_QUEUE, SEND_CLOSING_DIGEST_JOB } from './jobs/closing-digest.processor';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue(MONITORING_QUEUE) private readonly monitoringQueue: Queue,
    @InjectQueue(BILLING_QUEUE) private readonly billingQueue: Queue,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly notificationsQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.monitoringQueue.upsertJobScheduler(CHECK_OFFLINE_JOB, { every: 60_000 }, { name: CHECK_OFFLINE_JOB });
    await this.monitoringQueue.upsertJobScheduler(CHECK_TONER_JOB, { every: 300_000 }, { name: CHECK_TONER_JOB });
    await this.monitoringQueue.upsertJobScheduler(CHECK_SLA_JOB, { every: 300_000 }, { name: CHECK_SLA_JOB });
    await this.billingQueue.upsertJobScheduler(GENERATE_MONTHLY_CHARGES_JOB, { every: ONE_DAY_MS }, { name: GENERATE_MONTHLY_CHARGES_JOB });
    // Cron (not `every`) because the send hour actually matters for a daily
    // digest e-mail — 7am server time, unlike the other jobs here which just
    // need to run once every 24h from whenever the worker booted.
    await this.notificationsQueue.upsertJobScheduler(SEND_CLOSING_DIGEST_JOB, { pattern: '0 7 * * *' }, { name: SEND_CLOSING_DIGEST_JOB });
    this.logger.log('Monitoring/billing/notifications job schedulers registered');
  }
}
