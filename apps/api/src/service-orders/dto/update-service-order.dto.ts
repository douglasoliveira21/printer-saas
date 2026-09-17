import { PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { CreateServiceOrderDto } from './create-service-order.dto';

export enum ServiceOrderStatusDto {
  OPEN = 'OPEN',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_PART = 'WAITING_PART',
  WAITING_CUSTOMER = 'WAITING_CUSTOMER',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export class UpdateServiceOrderDto extends PartialType(CreateServiceOrderDto) {
  @IsOptional()
  @IsEnum(ServiceOrderStatusDto)
  status?: ServiceOrderStatusDto;

  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  solution?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
