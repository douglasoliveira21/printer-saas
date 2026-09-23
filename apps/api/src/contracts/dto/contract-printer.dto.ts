import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateContractPrinterDto {
  @IsUUID()
  printerId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceBw?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceColor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceScan?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedCost?: number;

  @IsOptional()
  @IsBoolean()
  monitoringDisabled?: boolean;
}

export class UpdateContractPrinterDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceBw?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceColor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceScan?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fixedCost?: number;

  @IsOptional()
  @IsBoolean()
  monitoringDisabled?: boolean;
}
