import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import { ListServiceOrdersQueryDto } from './dto/list-service-orders-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('service-orders')
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Post()
  @RequirePermissions('service_orders.create')
  create(@Body() dto: CreateServiceOrderDto) {
    return this.serviceOrdersService.create(dto);
  }

  @Get()
  @RequirePermissions('service_orders.view')
  findAll(@Query() query: ListServiceOrdersQueryDto) {
    return this.serviceOrdersService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('service_orders.view')
  findOne(@Param('id') id: string) {
    return this.serviceOrdersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('service_orders.edit')
  update(@Param('id') id: string, @Body() dto: UpdateServiceOrderDto) {
    return this.serviceOrdersService.update(id, dto);
  }
}
