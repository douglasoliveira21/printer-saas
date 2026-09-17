import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FinancialService } from './financial.service';
import { CreateFinancialEntryDto } from './dto/create-financial-entry.dto';
import { ListFinancialEntriesQueryDto } from './dto/list-financial-entries-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('financial')
@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Post('entries')
  @RequirePermissions('financial.create')
  create(@Body() dto: CreateFinancialEntryDto) {
    return this.financialService.create(dto);
  }

  @Get('entries')
  @RequirePermissions('financial.view')
  findAll(@Query() query: ListFinancialEntriesQueryDto) {
    return this.financialService.findAll(query);
  }

  @Get('summary')
  @RequirePermissions('financial.view')
  summary() {
    return this.financialService.summary();
  }

  @Patch('entries/:id/pay')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('financial.edit')
  markPaid(@Param('id') id: string) {
    return this.financialService.markPaid(id);
  }

  @Patch('entries/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('financial.edit')
  cancel(@Param('id') id: string) {
    return this.financialService.cancel(id);
  }
}
