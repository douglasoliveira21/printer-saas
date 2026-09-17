import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlatformService } from './platform.service';
import { SuperAdminGuard } from './super-admin.guard';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { AssignPlanDto } from './dto/assign-plan.dto';

/** Super Admin da plataforma (spec §79) — cross-tenant, sempre atrás de SuperAdminGuard. */
@ApiTags('platform')
@Controller('platform')
@UseGuards(SuperAdminGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('stats')
  stats() {
    return this.platformService.platformStats();
  }

  @Get('tenants')
  listTenants() {
    return this.platformService.listTenants();
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string) {
    return this.platformService.getTenant(id);
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateTenantDto) {
    return this.platformService.createTenant(dto);
  }

  @Patch('tenants/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTenantStatusDto) {
    return this.platformService.updateStatus(id, dto);
  }

  @Get('plans')
  listPlans() {
    return this.platformService.listPlans();
  }

  @Patch('tenants/:id/plan')
  assignPlan(@Param('id') id: string, @Body() dto: AssignPlanDto) {
    return this.platformService.assignPlan(id, dto.planId ?? null);
  }
}
