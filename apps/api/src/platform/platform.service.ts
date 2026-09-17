import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type { CreateTenantDto } from './dto/create-tenant.dto';
import type { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        document: true,
        email: true,
        status: true,
        isDemo: true,
        createdAt: true,
        _count: { select: { users: true, customers: true, printers: true, agents: true } },
      },
    });
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      document: t.document,
      email: t.email,
      status: t.status,
      isDemo: t.isDemo,
      createdAt: t.createdAt,
      usersCount: t._count.users,
      customersCount: t._count.customers,
      printersCount: t._count.printers,
      agentsCount: t._count.agents,
    }));
  }

  async getTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        legalName: true,
        document: true,
        email: true,
        phone: true,
        status: true,
        isDemo: true,
        createdAt: true,
        _count: { select: { users: true, customers: true, printers: true, agents: true, serviceOrders: true, contracts: true } },
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }
    return tenant;
  }

  async updateStatus(id: string, dto: UpdateTenantStatusDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }
    return this.prisma.tenant.update({ where: { id }, data: { status: dto.status } });
  }

  /** Platform-level tenant creation — bypasses the public self-service /auth/register-tenant flow. */
  createTenant(dto: CreateTenantDto) {
    return this.authService.registerTenant(dto);
  }

  listPlans() {
    return this.prisma.plan.findMany({ orderBy: { priceMonthly: 'asc' } });
  }

  async assignPlan(tenantId: string, planId: string | null) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }
    if (planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) {
        throw new NotFoundException('Plano não encontrado');
      }
    }
    return this.prisma.tenant.update({ where: { id: tenantId }, data: { planId } });
  }

  async platformStats() {
    const [tenants, activeTenants, printers, agents, onlineAgents] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.printer.count({ where: { status: 'MONITORED' } }),
      this.prisma.agent.count(),
      this.prisma.agent.count({ where: { status: 'ONLINE' } }),
    ]);
    return { tenants, activeTenants, printers, agents, onlineAgents };
  }
}
