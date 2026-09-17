import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ClsService } from 'nestjs-cls';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { AppClsStore } from '../../common/cls-store';
import type { AuthenticatedUser, JwtAccessPayload } from '../types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService<AppClsStore>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    // Deliberately queried on the raw (unscoped) client: at this point we
    // don't yet have a trusted tenant context — the token's own claims ARE
    // the source of truth we are validating.
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, tenantId: payload.tenantId, status: 'ACTIVE' },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }

    this.cls.set('tenantId', user.tenantId);
    this.cls.set('userId', user.id);
    this.cls.set('isSuperAdmin', user.isSuperAdmin);

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      isSuperAdmin: user.isSuperAdmin,
      roleId: user.roleId,
      permissions: user.role?.permissions.map((rp) => rp.permission.key) ?? [],
      customerId: user.customerId,
    };
  }
}
