import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateContractReadjustmentDto {
  @Type(() => Number)
  @IsNumber()
  percentage!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  effectiveMonth!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  effectiveYear!: number;

  @IsOptional()
  @IsBoolean()
  applyNow?: boolean;
}
