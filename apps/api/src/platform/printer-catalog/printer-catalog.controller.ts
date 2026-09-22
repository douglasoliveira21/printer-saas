import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrinterCatalogService } from './printer-catalog.service';
import { CreateCatalogModelDto } from './dto/create-catalog-model.dto';
import { UpdateCatalogModelDto } from './dto/update-catalog-model.dto';
import { SuperAdminGuard } from '../super-admin.guard';

/** Global printer model catalog — platform metadata (hardware facts), not tenant data. Super Admin only, same as the rest of /platform. */
@ApiTags('platform')
@Controller('platform/printer-catalog')
@UseGuards(SuperAdminGuard)
export class PrinterCatalogController {
  constructor(private readonly printerCatalogService: PrinterCatalogService) {}

  @Get()
  findAll() {
    return this.printerCatalogService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.printerCatalogService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCatalogModelDto) {
    return this.printerCatalogService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCatalogModelDto) {
    return this.printerCatalogService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.printerCatalogService.remove(id);
  }
}
