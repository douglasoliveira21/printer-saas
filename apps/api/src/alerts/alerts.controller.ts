import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @RequirePermissions('dashboard.view')
  findAll(@Query('status') status?: string, @Query('printerId') printerId?: string) {
    return this.alertsService.findAll(status, printerId);
  }

  @Patch(':id/acknowledge')
  @RequirePermissions('dashboard.view')
  acknowledge(@Param('id') id: string) {
    return this.alertsService.acknowledge(id);
  }

  @Patch(':id/resolve')
  @RequirePermissions('dashboard.view')
  resolve(@Param('id') id: string) {
    return this.alertsService.resolve(id);
  }
}
