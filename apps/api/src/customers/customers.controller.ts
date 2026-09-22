import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { SetWorkingHoursDto } from './dto/set-working-hours.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequirePermissions('customers.create')
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Get()
  @RequirePermissions('customers.view')
  findAll(@Query() pagination: PaginationDto) {
    return this.customersService.findAll(pagination);
  }

  @Get(':id')
  @RequirePermissions('customers.view')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('customers.edit')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('customers.delete')
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }

  @Get(':id/history')
  @RequirePermissions('customers.view')
  history(@Param('id') id: string) {
    return this.customersService.history(id);
  }

  @Get(':id/working-hours')
  @RequirePermissions('customers.view')
  getWorkingHours(@Param('id') id: string) {
    return this.customersService.getWorkingHours(id);
  }

  @Put(':id/working-hours')
  @RequirePermissions('customers.edit')
  setWorkingHours(@Param('id') id: string, @Body() dto: SetWorkingHoursDto) {
    return this.customersService.setWorkingHours(id, dto);
  }
}
