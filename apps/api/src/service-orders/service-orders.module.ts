import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceOrdersService, NOTIFICATIONS_QUEUE } from './service-orders.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule, BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  controllers: [ServiceOrdersController],
  providers: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
