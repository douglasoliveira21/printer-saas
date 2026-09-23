import { Module } from '@nestjs/common';
import { PreventiveMaintenanceController } from './preventive-maintenance.controller';
import { PreventiveMaintenanceService } from './preventive-maintenance.service';

@Module({
  controllers: [PreventiveMaintenanceController],
  providers: [PreventiveMaintenanceService],
})
export class PreventiveMaintenanceModule {}
