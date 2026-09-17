import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateContractDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  printerId?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyFee!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  franchisePages?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overagePriceBw?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overagePriceColor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  billingDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  slaHours?: number;

  @IsOptional()
  @IsString()
  readjustmentIndex?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
