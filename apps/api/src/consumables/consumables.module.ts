import { Module } from '@nestjs/common';
import { ConsumablesController } from './consumables.controller';
import { ConsumablesService } from './consumables.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [ConsumablesController],
  providers: [ConsumablesService],
})
export class ConsumablesModule {}
