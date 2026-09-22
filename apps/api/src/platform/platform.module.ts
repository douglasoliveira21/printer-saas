import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { SuperAdminGuard } from './super-admin.guard';
import { PrinterCatalogController } from './printer-catalog/printer-catalog.controller';
import { PrinterCatalogService } from './printer-catalog/printer-catalog.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PlatformController, PrinterCatalogController],
  providers: [PlatformService, SuperAdminGuard, PrinterCatalogService],
})
export class PlatformModule {}
