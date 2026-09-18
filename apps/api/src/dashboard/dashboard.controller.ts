import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @RequirePermissions('dashboard.view')
  summary(@Query('customerId') customerId?: string) {
    return this.dashboardService.summary(customerId);
  }

  @Get('page-usage')
  @RequirePermissions('dashboard.view')
  pageUsage(@Query('granularity') granularity: 'month' | 'day' = 'month', @Query('customerId') customerId?: string) {
    return this.dashboardService.pageUsage(granularity, { customerId });
  }

  @Get('top-customers')
  @RequirePermissions('dashboard.view')
  topCustomers(@Query('customerId') customerId?: string) {
    return this.dashboardService.topCustomersByUsage(customerId);
  }
}
