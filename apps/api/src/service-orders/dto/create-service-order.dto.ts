import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

export enum ServiceOrderPriorityDto {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// Definido aqui (não em update-service-order.dto.ts) para os dois arquivos
// compartilharem o mesmo enum sem import circular — Update reimporta este.
// A tela de abertura de chamado só oferece OPEN/SCHEDULED na prática (os
// demais só existem como transição depois de aberto, na tela de detalhe),
// mas o tipo aceita o enum inteiro porque Update também usa este campo.
export enum ServiceOrderStatusDto {
  OPEN = 'OPEN',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_PART = 'WAITING_PART',
  WAITING_CUSTOMER = 'WAITING_CUSTOMER',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
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
  @IsString()
  @MinLength(1)
  title!: string;

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
  @IsEnum(ServiceOrderStatusDto)
  status?: ServiceOrderStatusDto;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  arrivedAt?: string;

  @IsOptional()
  @IsDateString()
  departedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  travelCost?: number;

  /** Alerta existente (impressora/cliente) que motivou este chamado — ao ser informado, é vinculado a esta OS (Alert.serviceOrderId). */
  @IsOptional()
  @IsUUID()
  alertId?: string;

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
