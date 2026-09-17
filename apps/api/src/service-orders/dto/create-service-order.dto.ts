import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum ServiceOrderPriorityDto {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
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
  @IsEnum(ServiceOrderPriorityDto)
  priority?: ServiceOrderPriorityDto;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  slaDueAt?: string;
}
