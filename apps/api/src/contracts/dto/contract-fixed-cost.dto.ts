import { Type } from 'class-transformer';
import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class CreateContractFixedCostDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;
}
