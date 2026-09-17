import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrintersService } from './printers.service';
import { ListPrintersQueryDto } from './dto/list-printers-query.dto';
import { ClaimPrinterDto } from './dto/claim-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';
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

  @Patch(':id')
  @RequirePermissions('printers.edit')
  update(@Param('id') id: string, @Body() dto: UpdatePrinterDto) {
    return this.printersService.update(id, dto);
  }

  @Post(':id/claim')
  @RequirePermissions('printers.edit')
  claim(@Param('id') id: string, @Body() dto: ClaimPrinterDto) {
    return this.printersService.claim(id, dto);
  }

  @Patch(':id/ignore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('printers.edit')
  ignore(@Param('id') id: string) {
    return this.printersService.ignore(id);
  }

  @Patch(':id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('printers.edit')
  restore(@Param('id') id: string) {
    return this.printersService.restore(id);
  }

  @Patch(':id/decommission')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('printers.edit')
  decommission(@Param('id') id: string) {
    return this.printersService.decommission(id);
  }
}
