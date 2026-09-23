import { join, extname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { BadRequestException, Body, Controller, Get, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiTags } from '@nestjs/swagger';
import { TenantSettingsService } from './tenant-settings.service';
import { SetWorkingHoursDto } from '../customers/dto/set-working-hours.dto';
import { UpdateAlertThresholdsDto } from './dto/update-alert-thresholds.dto';
import { UpdateTenantInfoDto } from './dto/update-tenant-info.dto';
import { UpdateClosingSettingsDto } from './dto/update-closing-settings.dto';
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

  // No permission gate — every authenticated user needs this for basic
  // branding (sidebar logo/name), not just settings admins.
  @Get('info')
  getInfo() {
    return this.tenantSettingsService.getInfo();
  }

  @Put('info')
  @RequirePermissions('company_settings.edit')
  updateInfo(@Body() dto: UpdateTenantInfoDto) {
    return this.tenantSettingsService.updateInfo(dto);
  }

  @Post('logo')
  @RequirePermissions('company_settings.edit')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = join(process.cwd(), 'uploads', 'tenant-logo');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Apenas imagens são permitidas'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }
    return this.tenantSettingsService.updateLogo(`tenant-logo/${file.filename}`);
  }

  @Get('alert-thresholds')
  @RequirePermissions('settings.manage')
  getAlertThresholds() {
    return this.tenantSettingsService.getAlertThresholds();
  }

  @Put('alert-thresholds')
  @RequirePermissions('company_settings.edit')
  updateAlertThresholds(@Body() dto: UpdateAlertThresholdsDto) {
    return this.tenantSettingsService.updateAlertThresholds(dto);
  }

  // Read is broader than settings.manage on purpose — the printer detail
  // page (any user with printers.view) needs hideUnknownLevelSupplies/
  // hideNonTonerSupplies to render supplies correctly.
  @Get('closing-settings')
  @RequirePermissions('printers.view')
  getClosingSettings() {
    return this.tenantSettingsService.getClosingSettings();
  }

  @Put('closing-settings')
  @RequirePermissions('company_settings.edit')
  updateClosingSettings(@Body() dto: UpdateClosingSettingsDto) {
    return this.tenantSettingsService.updateClosingSettings(dto);
  }
}
