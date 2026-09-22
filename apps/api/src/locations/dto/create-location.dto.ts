import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLocationDto {
  @IsUUID()
  customerId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  costCenter?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  slaHours?: number;
}
