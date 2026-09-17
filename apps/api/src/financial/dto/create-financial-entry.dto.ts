import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export enum FinancialEntryTypeDto {
  RECEIVABLE = 'RECEIVABLE',
  PAYABLE = 'PAYABLE',
}

export class CreateFinancialEntryDto {
  @IsEnum(FinancialEntryTypeDto)
  type!: FinancialEntryTypeDto;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  costCenter?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsUUID()
  serviceOrderId?: string;
}
