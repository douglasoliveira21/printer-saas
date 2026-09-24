import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlatformEmailSettingsService } from './platform-email-settings.service';
import { UpdatePlatformEmailSettingsDto } from './dto/update-platform-email-settings.dto';
import { SuperAdminGuard } from '../super-admin.guard';

/** App Registration único do Azure AD usado por todo tenant que conectar via "Configurações > E-mail > Conectar com Microsoft" — plataforma inteira, não dado de um tenant, por isso Super Admin only, igual ao resto de /platform. */
@ApiTags('platform')
@Controller('platform/email-settings')
@UseGuards(SuperAdminGuard)
export class PlatformEmailSettingsController {
  constructor(private readonly service: PlatformEmailSettingsService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Put()
  update(@Body() dto: UpdatePlatformEmailSettingsDto) {
    return this.service.update(dto);
  }
}
