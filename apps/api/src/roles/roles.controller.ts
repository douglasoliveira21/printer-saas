import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

/** Read-only for now — roles themselves are created at tenant registration/seed (spec §35); this just feeds the user-assignment dropdown. */
@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  @Get()
  @RequirePermissions('settings.manage')
  findAll() {
    return this.tenantPrisma.client.role.findMany({ orderBy: { name: 'asc' } });
  }
}
