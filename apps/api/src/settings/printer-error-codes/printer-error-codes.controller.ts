import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrinterErrorCodesService } from './printer-error-codes.service';
import { CreatePrinterErrorCodeDto, UpdatePrinterErrorCodeDto } from './dto/printer-error-code.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('printer-error-codes')
@Controller('printer-error-codes')
export class PrinterErrorCodesController {
  constructor(private readonly service: PrinterErrorCodesService) {}

  @Get()
  @RequirePermissions('settings.manage')
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @RequirePermissions('company_settings.edit')
  create(@Body() dto: CreatePrinterErrorCodeDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('company_settings.edit')
  update(@Param('id') id: string, @Body() dto: UpdatePrinterErrorCodeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('company_settings.edit')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
