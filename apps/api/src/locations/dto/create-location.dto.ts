import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

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
}
