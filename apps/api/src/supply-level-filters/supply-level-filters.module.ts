import { Module } from '@nestjs/common';
import { SupplyLevelFiltersController } from './supply-level-filters.controller';
import { SupplyLevelFiltersService } from './supply-level-filters.service';

@Module({
  controllers: [SupplyLevelFiltersController],
  providers: [SupplyLevelFiltersService],
})
export class SupplyLevelFiltersModule {}
