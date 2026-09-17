import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from './prisma.service';
import type { AppClsStore } from '../common/cls-store';

/**
 * Request-scoped accessor for a tenant-bound Prisma client. The tenantId
 * comes exclusively from the authenticated request context (set by
 * JwtAuthGuard from the validated access token) — never from a header,
 * query param, or body supplied by the client.
 */
@Injectable()
export class TenantPrismaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService<AppClsStore>,
  ) {}

  get client() {
    const tenantId = this.cls.get('tenantId');
    if (!tenantId) {
      throw new UnauthorizedException('No tenant context available for this request');
    }
    return this.prisma.forTenant(tenantId);
  }

  get tenantId(): string {
    const tenantId = this.cls.get('tenantId');
    if (!tenantId) {
      throw new UnauthorizedException('No tenant context available for this request');
    }
    return tenantId;
  }

  get userId(): string | undefined {
    return this.cls.get('userId');
  }
}
