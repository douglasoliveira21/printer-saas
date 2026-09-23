import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SupplyLevelFiltersService } from './supply-level-filters.service';
import { CreateSupplyLevelFilterDto } from './dto/supply-level-filter.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('supply-level-filters')
@Controller('supply-level-filters')
@RequirePermissions('supply_levels.view')
export class SupplyLevelFiltersController {
  constructor(private readonly service: SupplyLevelFiltersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateSupplyLevelFilterDto) {
    return this.service.create(dto);
  }

  @Get(':id/rows')
  rows(@Param('id') id: string) {
    return this.service.rows(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
