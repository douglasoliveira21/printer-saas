import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrintersService } from './printers.service';
import { ListPrintersQueryDto } from './dto/list-printers-query.dto';
import { ClaimPrinterDto } from './dto/claim-printer.dto';
import { UpdatePrinterDto } from './dto/update-printer.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';

@ApiTags('printers')
@Controller('printers')
export class PrintersController {
  constructor(private readonly printersService: PrintersService) {}

  @Get()
  @RequirePermissions('printers.view')
  findAll(@Query() query: ListPrintersQueryDto) {
    return this.printersService.findAll(query);
  }

  /** "Monitoramentos duplicados" — same serial tracked more than once (e.g. printer changed IP). Static route declared before :id so it isn't captured as an id. */
  @Get('duplicates')
  @RequirePermissions('printers.view')
  duplicates() {
    return this.printersService.duplicates();
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

  @Get(':id/timeline')
  @RequirePermissions('printers.view')
  timeline(@Param('id') id: string) {
    return this.printersService.timeline(id);
  }

  @Get(':id/page-usage')
  @RequirePermissions('printers.view')
  pageUsage(@Param('id') id: string, @Query('granularity') granularity: 'month' | 'day' = 'month') {
    return this.printersService.pageUsage(id, granularity);
  }

  @Get(':id/comments')
  @RequirePermissions('printers.view')
  listComments(@Param('id') id: string) {
    return this.printersService.listComments(id);
  }

  @Post(':id/comments')
  @RequirePermissions('printers.edit')
  createComment(@Param('id') id: string, @Body() dto: CreateCommentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.printersService.createComment(id, user.id, dto.body);
  }
}
