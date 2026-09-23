import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import type { ChangeMyPasswordDto } from './dto/change-my-password.dto';

const USER_INCLUDE = {
  role: true,
  customer: { select: { id: true, legalName: true, tradeName: true } },
  directPermissions: { include: { permission: true } },
  visibleCustomers: { include: { customer: { select: { id: true, legalName: true, tradeName: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.tenantPrisma.client.user.findFirst({ where: { email: dto.email, deletedAt: null } });
    if (existing) {
      throw new ConflictException('E-mail já está em uso neste tenant');
    }
    if (dto.accountType === 'CUSTOMER') {
      const customer = await this.tenantPrisma.client.customer.findFirst({ where: { id: dto.customerId } });
      if (!customer) {
        throw new NotFoundException('Cliente não encontrado');
      }
    }

    const permissionIds = await this.resolvePermissionIds(dto.permissionKeys);
    const passwordHash = await argon2.hash(dto.password);

    const user = await this.tenantPrisma.client.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        accountType: dto.accountType ?? 'STAFF',
        roleId: dto.roleId,
        customerId: dto.accountType === 'CUSTOMER' ? dto.customerId : undefined,
        viewAllCustomers: dto.viewAllCustomers ?? true,
        notifyTicketAssigned: dto.notifyTicketAssigned ?? false,
        notifyTicketSlaExpiring: dto.notifyTicketSlaExpiring ?? false,
        notifyTicketSlaBreached: dto.notifyTicketSlaBreached ?? false,
        notifyTicketClosed: dto.notifyTicketClosed ?? false,
        notifyTicketCommented: dto.notifyTicketCommented ?? false,
        directPermissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
        visibleCustomers:
          dto.viewAllCustomers === false && dto.visibleCustomerIds?.length
            ? { create: dto.visibleCustomerIds.map((customerId) => ({ customerId })) }
            : undefined,
      } as any,
      include: USER_INCLUDE,
    });
    return this.toSafeUser(user);
  }

  async findAll() {
    const users = await this.tenantPrisma.client.user.findMany({
      where: { deletedAt: null },
      include: USER_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return users.map((u) => this.toSafeUser(u));
  }

  async findOne(id: string) {
    const user = await this.tenantPrisma.client.user.findFirst({ where: { id, deletedAt: null }, include: USER_INCLUDE });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return this.toSafeUser(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.assertExists(id);
    if (dto.roleId) {
      const role = await this.tenantPrisma.client.role.findFirst({ where: { id: dto.roleId } });
      if (!role) {
        throw new NotFoundException('Perfil não encontrado');
      }
    }
    const nextAccountType = dto.accountType ?? existing.accountType;
    if (nextAccountType === 'CUSTOMER') {
      const customerId = dto.customerId ?? existing.customerId;
      if (!customerId) {
        throw new BadRequestException('Conta de cliente precisa de um cliente selecionado');
      }
      const customer = await this.tenantPrisma.client.customer.findFirst({ where: { id: customerId } });
      if (!customer) {
        throw new NotFoundException('Cliente não encontrado');
      }
    }

    const data: Record<string, unknown> = {
      name: dto.name,
      roleId: dto.roleId,
      status: dto.status,
      accountType: dto.accountType,
      customerId: nextAccountType === 'CUSTOMER' ? (dto.customerId ?? existing.customerId) : dto.accountType === 'STAFF' ? null : undefined,
      viewAllCustomers: dto.viewAllCustomers,
      notifyTicketAssigned: dto.notifyTicketAssigned,
      notifyTicketSlaExpiring: dto.notifyTicketSlaExpiring,
      notifyTicketSlaBreached: dto.notifyTicketSlaBreached,
      notifyTicketClosed: dto.notifyTicketClosed,
      notifyTicketCommented: dto.notifyTicketCommented,
    };
    if (dto.password) {
      data.passwordHash = await argon2.hash(dto.password);
    }

    await this.tenantPrisma.client.user.update({ where: { id }, data });

    if (dto.permissionKeys) {
      const permissionIds = await this.resolvePermissionIds(dto.permissionKeys);
      await this.tenantPrisma.client.userPermission.deleteMany({ where: { userId: id } });
      if (permissionIds.length > 0) {
        await this.tenantPrisma.client.userPermission.createMany({
          data: permissionIds.map((permissionId) => ({ userId: id, permissionId })) as any,
        });
      }
    }

    if (dto.visibleCustomerIds || dto.viewAllCustomers !== undefined) {
      await this.tenantPrisma.client.userVisibleCustomer.deleteMany({ where: { userId: id } });
      if (dto.viewAllCustomers === false && dto.visibleCustomerIds?.length) {
        await this.tenantPrisma.client.userVisibleCustomer.createMany({
          data: dto.visibleCustomerIds.map((customerId) => ({ userId: id, customerId })) as any,
        });
      }
    }

    return this.findOne(id);
  }

  /** Deactivates rather than hard-deletes — preserves audit trail and any OS/records the user is attached to. */
  async deactivate(id: string) {
    await this.assertExists(id);
    const user = await this.tenantPrisma.client.user.update({ where: { id }, data: { status: 'INACTIVE' }, include: USER_INCLUDE });
    return this.toSafeUser(user);
  }

  async activate(id: string) {
    await this.assertExists(id);
    const user = await this.tenantPrisma.client.user.update({ where: { id }, data: { status: 'ACTIVE' }, include: USER_INCLUDE });
    return this.toSafeUser(user);
  }

  /** Soft delete — see User.deletedAt comment in schema.prisma. Excluded from every findAll/findOne/login query from this point on. */
  async remove(id: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new ForbiddenException('Você não pode excluir sua própria conta');
    }
    await this.assertExists(id);
    await this.tenantPrisma.client.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' } });
    return { removed: true };
  }

  /** Self-service — no settings.manage needed, any authenticated user can edit their own display name. Never touches email/permissions/status. */
  async updateMyProfile(id: string, dto: UpdateMyProfileDto) {
    await this.tenantPrisma.client.user.update({ where: { id }, data: { name: dto.name } });
    return this.findOne(id);
  }

  /** Self-service password change — requires the current password, unlike the admin reset flow in update(). */
  async changeMyPassword(id: string, dto: ChangeMyPasswordDto) {
    const user = await this.tenantPrisma.client.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Senha atual incorreta');
    }
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.tenantPrisma.client.user.update({ where: { id }, data: { passwordHash } });
    return { changed: true };
  }

  private async resolvePermissionIds(keys: string[] | undefined): Promise<string[]> {
    if (!keys || keys.length === 0) return [];
    const permissions = await this.tenantPrisma.client.permission.findMany({ where: { key: { in: keys } } });
    return permissions.map((p) => p.id);
  }

  private toSafeUser<T extends { passwordHash: string }>(user: T) {
    const { passwordHash: _omit, ...safe } = user;
    return safe;
  }

  private async assertExists(id: string) {
    const user = await this.tenantPrisma.client.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return user;
  }
}
