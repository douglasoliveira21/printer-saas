import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The Worker runs scheduled/cross-tenant jobs (offline detection, alert
 * generation) and therefore uses the raw, unscoped Prisma client — unlike
 * the API, there is no per-request tenant context here. Every query in this
 * app MUST explicitly filter by tenantId where relevant instead of relying
 * on request-scoped enforcement.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
