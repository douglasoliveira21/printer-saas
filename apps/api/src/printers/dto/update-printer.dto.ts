import { IsOptional, IsString } from 'class-validator';

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
}
