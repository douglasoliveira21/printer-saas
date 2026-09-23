import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateContractDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  printerId?: string;

  @IsDateString()
  startDate!: string;

  // null explicitly clears the end date (contrato por tempo indeterminado);
  // undefined/omitted means "leave it as-is" on update.
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

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

  @IsOptional()
  @IsBoolean()
  printNotesOnClosing?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultPriceBw?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultPriceColor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultPriceScan?: number;
}
