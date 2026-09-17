import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { tenantScopedExtension } from './tenant-scoped.extension';

/**
 * Raw, unscoped Prisma client. Inject this ONLY in code that legitimately
 * needs cross-tenant access: auth (login doesn't know the tenant yet),
 * platform super-admin endpoints, and internal bootstrap/seed scripts.
 * Everything else should use `forTenant(tenantId)`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Returns a Prisma client bound to a single tenant. Every query against a
   * tenant-owned model is automatically filtered/tagged with this tenantId.
   * See `tenantScopedExtension` for the enforcement details.
   */
  forTenant(tenantId: string) {
    return this.$extends(tenantScopedExtension(tenantId));
  }
}

export type TenantPrismaClient = ReturnType<PrismaService['forTenant']>;
