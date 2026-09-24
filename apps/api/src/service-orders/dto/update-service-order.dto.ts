import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CreateServiceOrderDto, ServiceOrderStatusDto } from './create-service-order.dto';

export { ServiceOrderStatusDto };

export enum ServiceOrderBillingTypeDto {
  CONTRACT = 'CONTRACT',
  CHARGE_CUSTOMER = 'CHARGE_CUSTOMER',
  WARRANTY = 'WARRANTY',
  COURTESY = 'COURTESY',
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
  causeIdentified?: string;

  @IsOptional()
  @IsString()
  testsPerformed?: string;

  @IsOptional()
  @IsString()
  defectiveParts?: string;

  @IsOptional()
  @IsString()
  suppliesUsed?: string;

  @IsOptional()
  @IsString()
  technicalNotes?: string;

  @IsOptional()
  @IsString()
  solution?: string;

  @IsOptional()
  @IsEnum(ServiceOrderBillingTypeDto)
  billingType?: ServiceOrderBillingTypeDto;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  laborCost?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  mileageKm?: number;

  @IsOptional()
  @IsString()
  activityPerformed?: string;

  @IsOptional()
  @IsString()
  attendanceNotes?: string;

  @IsOptional()
  @IsBoolean()
  equipmentWorking?: boolean;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
