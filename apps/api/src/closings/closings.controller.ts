import { Controller, Get, Param, Post, Query, Res, Body } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { ClosingsService } from './closings.service';
import { GenerateClosingDto } from './dto/generate-closing.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('closings')
@Controller('closings')
export class ClosingsController {
  constructor(private readonly closingsService: ClosingsService) {}

  @Post('generate')
  @RequirePermissions('financial.create')
  generate(@Body() dto: GenerateClosingDto) {
    return this.closingsService.generate(dto.customerId, dto.year, dto.month);
  }

  @Get()
  @RequirePermissions('financial.view')
  findAll(@Query('customerId') customerId: string, @Query('year') year?: string) {
    return this.closingsService.findAllForCustomer(customerId, year ? Number(year) : undefined);
  }

  @Get(':id')
  @RequirePermissions('financial.view')
  findOne(@Param('id') id: string) {
    return this.closingsService.findOne(id);
  }

  @Get(':id/pdf')
  @RequirePermissions('financial.view')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.closingsService.generatePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="fechamento-${id}.pdf"`);
    res.send(buffer);
  }
}
