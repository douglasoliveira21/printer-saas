import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types';

/**
 * Guards the customer-portal routes (spec §34). Only users created with a
 * `customerId` (see UsersService/CreateUserDto) may use them — regular
 * tenant staff (admin/technician/finance...) are rejected here, and portal
 * users are rejected by every *other* controller implicitly because they
 * hold no RBAC permissions (a portal user's roleId is left null).
 */
@Injectable()
export class PortalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user: AuthenticatedUser | undefined = context.switchToHttp().getRequest().user;
    if (!user?.customerId) {
      throw new ForbiddenException('Este endpoint é exclusivo para usuários do portal do cliente');
    }
    return true;
  }
}
