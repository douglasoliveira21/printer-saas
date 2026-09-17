import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.tenantPrisma.client.user.findFirst({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('E-mail já está em uso neste tenant');
    }
    if (dto.customerId) {
      const customer = await this.tenantPrisma.client.customer.findFirst({ where: { id: dto.customerId } });
      if (!customer) {
        throw new NotFoundException('Cliente não encontrado');
      }
    }
    const passwordHash = await argon2.hash(dto.password);
    // tenantId is injected at runtime by the tenant-scoped Prisma extension.
    const user = await this.tenantPrisma.client.user.create({
      data: { name: dto.name, email: dto.email, passwordHash, roleId: dto.roleId, customerId: dto.customerId } as any,
    });
    const { passwordHash: _omit, ...safe } = user;
    return safe;
  }

  async findAll() {
    const users = await this.tenantPrisma.client.user.findMany({
      include: { role: true },
      orderBy: { name: 'asc' },
    });
    return users.map((user) => {
      const { passwordHash: _omit, ...safe } = user;
      return safe;
    });
  }

  async findOne(id: string) {
    const user = await this.tenantPrisma.client.user.findFirst({ where: { id }, include: { role: true } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    const { passwordHash: _omit, ...safe } = user;
    return safe;
  }
}
