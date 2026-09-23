import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportDeliveriesService } from './report-deliveries.service';
import { UpdateReportDeliveryDto } from './dto/update-report-delivery.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('report-deliveries')
@Controller('report-deliveries')
export class ReportDeliveriesController {
  constructor(private readonly service: ReportDeliveriesService) {}

  @Get()
  @RequirePermissions('settings.manage')
  findAll() {
    return this.service.findAll();
  }

  @Put(':reportType')
  @RequirePermissions('company_settings.edit')
  update(@Param('reportType') reportType: string, @Body() dto: UpdateReportDeliveryDto) {
    return this.service.update(reportType as any, dto);
  }
}
