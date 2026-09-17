import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrintersService } from './printers.service';
import { ListPrintersQueryDto } from './dto/list-printers-query.dto';
import { ClaimPrinterDto } from './dto/claim-printer.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('printers')
@Controller('printers')
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Get()
  @RequirePermissions('printers.view')
  findAll(@Query() query: ListPrintersQueryDto) {
    return this.printersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('printers.view')
  findOne(@Param('id') id: string) {
    return this.printersService.findOne(id);
  }

  @Post(':id/claim')
  @RequirePermissions('printers.edit')
  claim(@Param('id') id: string, @Body() dto: ClaimPrinterDto) {
    return this.printersService.claim(id, dto);
  }

  @Patch(':id/ignore')
  @RequirePermissions('printers.edit')
  ignore(@Param('id') id: string) {
    return this.printersService.ignore(id);
  }
}
