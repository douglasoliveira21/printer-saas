import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServiceOrderTypesService } from './service-order-types.service';
import { CreateServiceOrderTypeDto, UpdateServiceOrderTypeDto } from './dto/service-order-type.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('service-order-types')
@Controller('service-order-types')
export class ServiceOrderTypesController {
  constructor(private readonly service: ServiceOrderTypesService) {}

  // Read is gated by service_orders.view (not settings.manage) — the ticket
  // creation dropdown needs this list for anyone who can open a ticket.
  @Get()
  @RequirePermissions('service_orders.view')
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @RequirePermissions('company_settings.edit')
  create(@Body() dto: CreateServiceOrderTypeDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('company_settings.edit')
  update(@Param('id') id: string, @Body() dto: UpdateServiceOrderTypeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('company_settings.edit')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
