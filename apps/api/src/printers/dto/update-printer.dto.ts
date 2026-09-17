import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePrinterDto {
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  slaHours?: number;
}
