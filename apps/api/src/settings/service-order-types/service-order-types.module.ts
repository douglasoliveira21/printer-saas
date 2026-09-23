import { Module } from '@nestjs/common';
import { ServiceOrderTypesController } from './service-order-types.controller';
import { ServiceOrderTypesService } from './service-order-types.service';

@Module({
  controllers: [ServiceOrderTypesController],
  providers: [ServiceOrderTypesService],
})
export class ServiceOrderTypesModule {}
