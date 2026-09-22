import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

const DEVICE_TYPES = ['PRINTER', 'MFP', 'PLOTTER'] as const;
const CONFIDENCE_LEVELS = ['ALTA', 'MEDIA', 'BAIXA'] as const;
const MODEL_STATUS = ['ATUAL', 'DESCONTINUADO', 'ANTIGO', 'A_CONFIRMAR'] as const;

class CapabilitiesDto {
  @IsOptional()
  color?: boolean | null;

  @IsOptional()
  duplex?: boolean | null;

  @IsOptional()
  a3?: boolean | null;

  @IsOptional()
  copy?: boolean | null;

  @IsOptional()
  scan?: boolean | null;

  @IsOptional()
  fax?: boolean | null;
}

export class CreateCatalogModelDto {
  @IsString()
  @MinLength(1)
  manufacturer!: string;

  @IsString()
  @MinLength(1)
  model!: string;

  @IsOptional()
  @IsString()
  family?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsIn(DEVICE_TYPES)
  deviceType?: (typeof DEVICE_TYPES)[number];

  @ValidateNested()
  @Type(() => CapabilitiesDto)
  capabilities!: CapabilitiesDto;

  @IsOptional()
  countersAvailable?: Record<string, boolean>;

  @IsOptional()
  suppliesAvailable?: Record<string, boolean>;

  @IsIn(CONFIDENCE_LEVELS)
  confidence!: (typeof CONFIDENCE_LEVELS)[number];

  @IsOptional()
  @IsIn(MODEL_STATUS)
  status?: (typeof MODEL_STATUS)[number];

  @IsOptional()
  @IsString()
  sourcePrimary?: string;

  @IsOptional()
  @IsString()
  sourcesSecondary?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
