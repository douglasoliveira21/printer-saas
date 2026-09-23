import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantSettingsService } from './tenant-settings.service';
import { SetWorkingHoursDto } from '../customers/dto/set-working-hours.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('tenant-settings')
@Controller('tenant')
export class TenantSettingsController {
  constructor(private readonly tenantSettingsService: TenantSettingsService) {}

  @Get('working-hours')
  @RequirePermissions('settings.manage')
  getWorkingHours() {
    return this.tenantSettingsService.getWorkingHours();
  }

  @Put('working-hours')
  @RequirePermissions('company_settings.edit')
  setWorkingHours(@Body() dto: SetWorkingHoursDto) {
    return this.tenantSettingsService.setWorkingHours(dto);
  }
}
