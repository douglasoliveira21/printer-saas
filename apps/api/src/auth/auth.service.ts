import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { JwtService } from '@nestjs/jwt';
import type { Queue } from 'bullmq';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import ms from './ms';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterTenantDto } from './dto/register-tenant.dto';
import type { JwtAccessPayload } from './types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Same queue apps/worker/src/jobs/closing-digest.processor.ts listens on —
// redeclared here rather than imported across the api/worker boundary,
// same convention as NOTIFICATIONS_QUEUE in service-orders.service.ts.
const NOTIFICATIONS_QUEUE = 'notifications';
const PASSWORD_RESET_JOB = 'password-reset';
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly notificationsQueue: Queue,
  ) {}

  async registerTenant(dto: RegisterTenantDto) {
    const existing = await this.prisma.user.findFirst({ where: { email: dto.adminEmail, deletedAt: null } });
    if (existing) {
      throw new ConflictException('E-mail já está em uso');
    }

    const allPermissions = await this.prisma.permission.findMany();
    const passwordHash = await argon2.hash(dto.adminPassword);

    const tenant = await this.prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: { name: dto.companyName },
      });

      const adminRole = await tx.role.create({
        data: {
          tenantId: createdTenant.id,
          name: 'Admin',
          isSystem: true,
          permissions: {
            create: allPermissions.map((p) => ({ permissionId: p.id })),
          },
        },
      });

      await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          name: dto.adminName,
          email: dto.adminEmail,
          passwordHash,
          roleId: adminRole.id,
        },
      });

      return createdTenant;
    });

    return this.login({ email: dto.adminEmail, password: dto.adminPassword }, tenant.id);
  }

  async login(dto: LoginDto, expectedTenantId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null, ...(expectedTenantId ? { tenantId: expectedTenantId } : {}) },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const tokens = await this.issueTokenPair(user.id, user.tenantId, user.isSuperAdmin);
    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: user.tenantId,
        isSuperAdmin: user.isSuperAdmin,
        customerId: user.customerId,
      },
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão expirada, faça login novamente');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    if (stored.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuário inativo');
    }

    return this.issueTokenPair(stored.user.id, stored.user.tenantId, stored.user.isSuperAdmin);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Always resolves the same way regardless of whether the e-mail matches a
   * real account — never reveals account existence to the caller (spec:
   * avoid e-mail enumeration). When it does match, enqueues the reset e-mail
   * on the same NOTIFICATIONS_QUEUE the ticket-assigned/closed e-mails use,
   * sent through that user's own tenant mail provider (MailerService).
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, status: 'ACTIVE' },
    });

    if (user) {
      const token = randomBytes(32).toString('hex');
      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        },
      });

      const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
      void this.notificationsQueue.add(PASSWORD_RESET_JOB, {
        tenantId: user.tenantId,
        email: user.email,
        name: user.name,
        resetUrl: `${frontendUrl}/redefinir-senha?token=${token}`,
      });
    }

    return { message: 'Se o e-mail existir, enviamos instruções para redefinir a senha.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);
    const stored = await this.prisma.passwordResetToken.findFirst({ where: { tokenHash } });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException('Link inválido ou expirado — solicite uma nova redefinição de senha.');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      // A senha trocada invalida todas as sessões já abertas — mesmo raciocínio
      // de qualquer fluxo de "esqueci a senha": se a conta foi comprometida, os
      // refresh tokens antigos não devem continuar valendo.
      this.prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    return { message: 'Senha redefinida com sucesso.' };
  }

  private async issueTokenPair(userId: string, tenantId: string, isSuperAdmin: boolean): Promise<TokenPair> {
    const payload: JwtAccessPayload = { sub: userId, tenantId, isSuperAdmin };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow('JWT_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshToken = randomBytes(48).toString('hex');
    const refreshExpiresIn = this.config.get('JWT_REFRESH_EXPIRES_IN', '30d');

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + ms(refreshExpiresIn)),
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
