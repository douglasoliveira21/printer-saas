import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export enum ServiceOrderPriorityDto {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum ServiceOrderTypeDto {
  CORRECTIVE_MAINTENANCE = 'CORRECTIVE_MAINTENANCE',
  PREVENTIVE_MAINTENANCE = 'PREVENTIVE_MAINTENANCE',
  INSTALLATION = 'INSTALLATION',
  EQUIPMENT_REPLACEMENT = 'EQUIPMENT_REPLACEMENT',
  DELIVERY_PICKUP = 'DELIVERY_PICKUP',
  PRINT_ISSUE = 'PRINT_ISSUE',
  CONFIGURATION = 'CONFIGURATION',
  TECHNICAL_SUPPORT = 'TECHNICAL_SUPPORT',
  OTHER = 'OTHER',
}

export class CreateServiceOrderDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  printerId?: string;

  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsEnum(ServiceOrderTypeDto)
  serviceType?: ServiceOrderTypeDto;

  /** Tipo do catálogo gerenciável (Configurações > Chamados) — substitui serviceType na UI nova. */
  @IsOptional()
  @IsUUID()
  serviceOrderTypeCatalogId?: string;

  @IsOptional()
  @IsEnum(ServiceOrderPriorityDto)
  priority?: ServiceOrderPriorityDto;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  slaDueAt?: string;

  /** Se omitido e serviceOrderTypeCatalogId tiver defaultPrice, é prefiládo automaticamente. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  laborCost?: number;
}
