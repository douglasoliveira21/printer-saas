import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types';

/**
 * Guards the platform (super-admin) routes (spec §79). These are the only
 * endpoints in the whole API that operate across tenants — everywhere else
 * the tenant-scoped Prisma extension makes cross-tenant access structurally
 * impossible, so this guard is the single deliberate exception and must
 * stay narrow: platform metadata only (tenant status, aggregate counts),
 * never a tenant's commercial/customer data (spec §79's own instruction).
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;
    if (!user?.isSuperAdmin) {
      throw new ForbiddenException('Restrito ao Super Admin da plataforma');
    }
    return true;
  }
}
