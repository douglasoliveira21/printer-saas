import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationSettingsService } from './notification-settings.service';
import { UpdateNotificationSettingDto } from './dto/update-notification-setting.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('notification-settings')
@Controller('notification-settings')
export class NotificationSettingsController {
  constructor(private readonly service: NotificationSettingsService) {}

  @Get()
  @RequirePermissions('settings.manage')
  findAll() {
    return this.service.findAll();
  }

  @Put(':type')
  @RequirePermissions('company_settings.edit')
  update(@Param('type') type: string, @Body() dto: UpdateNotificationSettingDto) {
    return this.service.update(type as any, dto);
  }
}
