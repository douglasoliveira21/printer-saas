import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

class ListLocationsQuery {
  @IsUUID()
  customerId!: string;
}

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @RequirePermissions('customers.edit')
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
  }

  @Get()
  @RequirePermissions('customers.view')
  findByCustomer(@Query() query: ListLocationsQuery) {
    return this.locationsService.findByCustomer(query.customerId);
  }

  @Get(':id')
  @RequirePermissions('customers.view')
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('customers.edit')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('customers.edit')
  remove(@Param('id') id: string) {
    return this.locationsService.remove(id);
  }

  @Patch(':id/primary')
  @RequirePermissions('customers.edit')
  setPrimary(@Param('id') id: string) {
    return this.locationsService.setPrimary(id);
  }
}
