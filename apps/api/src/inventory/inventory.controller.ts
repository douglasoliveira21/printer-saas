import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('items')
  @RequirePermissions('inventory.create')
  create(@Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.create(dto);
  }

  @Get('items')
  @RequirePermissions('inventory.view')
  findAll() {
    return this.inventoryService.findAll();
  }

  @Get('items/:id')
  @RequirePermissions('inventory.view')
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Patch('items/:id')
  @RequirePermissions('inventory.edit')
  update(@Param('id') id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryService.update(id, dto);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('inventory.edit')
  remove(@Param('id') id: string) {
    return this.inventoryService.remove(id);
  }

  @Post('items/:id/movements')
  @RequirePermissions('inventory.create')
  createMovement(@Param('id') id: string, @Body() dto: CreateMovementDto) {
    return this.inventoryService.createMovement(id, dto);
  }
}
