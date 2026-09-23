import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportEmailRecipientsService } from './report-email-recipients.service';
import { CreateReportEmailRecipientDto } from './dto/create-report-email-recipient.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('report-email-recipients')
@Controller('report-email-recipients')
export class ReportEmailRecipientsController {
  constructor(private readonly service: ReportEmailRecipientsService) {}

  // Read access is broader than settings.manage on purpose — a contract's
  // "E-mail" tab (any user with contracts.view) needs to display this list
  // read-only; only adding/removing recipients is settings-admin-gated.
  @Get()
  @RequirePermissions('contracts.view')
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @RequirePermissions('settings.manage')
  create(@Body() dto: CreateReportEmailRecipientDto) {
    return this.service.create(dto);
  }

  @Delete(':id')
  @RequirePermissions('settings.manage')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
