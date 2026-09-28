import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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

class DeviceAlertDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  severity?: string;
}

class DeviceCapabilitiesDto {
  @IsOptional()
  @IsBoolean()
  color?: boolean;

  @IsOptional()
  @IsBoolean()
  duplex?: boolean;

  @IsOptional()
  @IsBoolean()
  a3?: boolean;

  @IsOptional()
  @IsBoolean()
  copy?: boolean;

  @IsOptional()
  @IsBoolean()
  scan?: boolean;

  @IsOptional()
  @IsBoolean()
  fax?: boolean;
}

const DEVICE_TYPES = [
  'UNKNOWN', 'PRINTER', 'MFP', 'PLOTTER', 'ROUTER', 'FIREWALL', 'SWITCH', 'ACCESS_POINT', 'SERVER', 'COMPUTER', 'CAMERA',
] as const;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeviceAlertDto)
  alerts?: DeviceAlertDto[];

  @IsOptional()
  @IsIn(DEVICE_TYPES)
  deviceType?: (typeof DEVICE_TYPES)[number];

  @IsOptional()
  @IsNumber()
  classificationConfidence?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classificationEvidence?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceCapabilitiesDto)
  capabilities?: DeviceCapabilitiesDto;

  @IsOptional()
  capabilitySources?: Record<string, string>;

  @IsOptional()
  diagnostics?: Record<string, string>;

  // Fase 13 (IPP avançado) — printer-state/media-ready. Faltavam aqui desde
  // que o Agent passou a enviá-los: com `forbidNonWhitelisted: true` (ver
  // main.ts), a API rejeitava o lote INTEIRO com 400 assim que um device
  // continha qualquer um desses dois campos — o que fazia a varredura
  // "encontrar" impressoras no Agent, mas nenhuma delas chegar a ser salva.
  @IsOptional()
  @IsString()
  printerState?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaReady?: string[];
}

export class SubmitDevicesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeviceDto)
  devices!: DeviceDto[];

  // Optional so Agents older than this feature (no collectionId sent) keep
  // working exactly as before — see AgentsService.submitDevices, which only
  // applies the idempotency guard when this is present.
  @IsOptional()
  @IsUUID()
  collectionId?: string;
}
