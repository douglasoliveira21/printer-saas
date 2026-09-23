import { IsString, IsUUID } from 'class-validator';

export class CreateSupplyLevelFilterDto {
  @IsString()
  name!: string;

  @IsUUID()
  customerId!: string;
}
