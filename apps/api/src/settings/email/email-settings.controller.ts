import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EmailSettingsService } from './email-settings.service';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('email-settings')
@Controller('email-settings')
export class EmailSettingsController {
  constructor(private readonly service: EmailSettingsService) {}

  @Get()
  @RequirePermissions('settings.manage')
  get() {
    return this.service.get();
  }

  @Put()
  @RequirePermissions('company_settings.edit')
  update(@Body() dto: UpdateEmailSettingsDto) {
    return this.service.update(dto);
  }
}
