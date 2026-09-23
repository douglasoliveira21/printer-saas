import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('departments')
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  // Read is gated by printers.view (not settings.manage) on purpose — the
  // printer edit dialog needs this list to assign a department, and that's
  // a much more common permission than settings admin.
  @Get()
  @RequirePermissions('printers.view')
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @RequirePermissions('company_settings.edit')
  create(@Body() dto: CreateDepartmentDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('company_settings.edit')
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('company_settings.edit')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
