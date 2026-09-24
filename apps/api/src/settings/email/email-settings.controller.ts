import { Body, Controller, Delete, Get, Put, Query, Redirect } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EmailSettingsService } from './email-settings.service';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';

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

  @Get('m365/connect')
  @RequirePermissions('company_settings.edit')
  getM365ConnectUrl() {
    return this.service.getM365ConnectUrl();
  }

  // Chamado direto pela Microsoft (redirect do navegador do usuário logado
  // no tenant) — nunca carrega o JWT do app, só o `state` assinado que
  // getM365ConnectUrl gerou. Guard normal não se aplica aqui.
  @Public()
  @Get('m365/callback')
  @Redirect()
  async m365Callback(@Query('code') code?: string, @Query('state') state?: string) {
    const url = await this.service.handleM365Callback(code, state);
    return { url };
  }

  @Delete('m365')
  @RequirePermissions('company_settings.edit')
  disconnectM365() {
    return this.service.disconnectM365();
  }
}
