import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class EnrollAgentDto {
  @IsString()
  enrollmentToken!: string;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  agentVersion?: string;
}

export class HeartbeatDto {
  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  osVersion?: string;

  @IsOptional()
  @IsString()
  localIp?: string;

  @IsOptional()
  @IsString()
  agentVersion?: string;
}

class DeviceCountersDto {
  @IsOptional()
  @IsInt()
  total?: number;

  @IsOptional()
  @IsInt()
  blackWhite?: number;

  @IsOptional()
  @IsInt()
  color?: number;

  @IsOptional()
  @IsInt()
  copies?: number;

  @IsOptional()
  raw?: Record<string, unknown>;
}

class DeviceConsumableDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  levelPercent?: number;

  @IsOptional()
  @IsString()
  capacity?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  serial?: string;
}

class DeviceDto {
  @IsOptional()
  @IsString()
  ip?: string;

  @IsOptional()
  @IsString()
  mac?: string;

  @IsOptional()
  @IsString()
  hostname?: string;

  @IsOptional()
  @IsString()
  serial?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  firmware?: string;

  @IsOptional()
  @IsString()
  sysDescr?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceCountersDto)
  counters?: DeviceCountersDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeviceConsumableDto)
  consumables?: DeviceConsumableDto[];

  @IsOptional()
  @IsIn(['SNMP', 'MANUAL'])
  collectionMethod?: 'SNMP' | 'MANUAL';

  @IsOptional()
  @IsBoolean()
  supportsA3?: boolean;
}

export class SubmitDevicesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeviceDto)
  devices!: DeviceDto[];
}
