import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateContractPricingTierDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fromPage!: number;

  // null/omitted = no upper bound (last bracket).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  toPage?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  pricePerPage!: number;
}
