import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PreventiveMaintenanceService } from './preventive-maintenance.service';
import { CreatePreventiveMaintenanceScheduleDto, UpdatePreventiveMaintenanceScheduleDto } from './dto/preventive-maintenance.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('preventive-maintenance')
@Controller('preventive-maintenance')
export class PreventiveMaintenanceController {
  constructor(private readonly service: PreventiveMaintenanceService) {}

  @Get()
  @RequirePermissions('settings.manage')
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @RequirePermissions('company_settings.edit')
  create(@Body() dto: CreatePreventiveMaintenanceScheduleDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('company_settings.edit')
  update(@Param('id') id: string, @Body() dto: UpdatePreventiveMaintenanceScheduleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('company_settings.edit')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
