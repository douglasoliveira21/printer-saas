import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { SuperAdminGuard } from './super-admin.guard';
import { PrinterCatalogController } from './printer-catalog/printer-catalog.controller';
import { PrinterCatalogService } from './printer-catalog/printer-catalog.service';
import { AgentReleasesController } from './agent-releases/agent-releases.controller';
import { AgentReleasesService } from './agent-releases/agent-releases.service';
import { PlatformEmailSettingsController } from './email-settings/platform-email-settings.controller';
import { PlatformEmailSettingsService } from './email-settings/platform-email-settings.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PlatformController, PrinterCatalogController, AgentReleasesController, PlatformEmailSettingsController],
  providers: [PlatformService, SuperAdminGuard, PrinterCatalogService, AgentReleasesService, PlatformEmailSettingsService],
  exports: [AgentReleasesService, PlatformEmailSettingsService],
})
export class PlatformModule {}
