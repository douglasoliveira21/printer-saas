import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConsumablesService } from './consumables.service';
import { CreateReplacementDto } from './dto/create-replacement.dto';
import { ListReplacementsQueryDto } from './dto/list-replacements-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('consumables')
@Controller('consumables')
export class ConsumablesController {
  constructor(private readonly consumablesService: ConsumablesService) {}

  @Get('forecast')
  @RequirePermissions('printers.view')
  forecast() {
    return this.consumablesService.forecast();
  }

  @Get('replacements')
  @RequirePermissions('printers.view')
  listReplacements(@Query() query: ListReplacementsQueryDto) {
    return this.consumablesService.listReplacements(query);
  }

  @Post(':printerId/replacements')
  @RequirePermissions('printers.edit')
  createReplacement(@Param('printerId') printerId: string, @Body() dto: CreateReplacementDto) {
    return this.consumablesService.createReplacement(printerId, dto);
  }
}
