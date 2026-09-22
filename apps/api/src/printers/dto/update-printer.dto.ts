import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  slaHours?: number;

  @IsOptional()
  @IsIn(['SNMP', 'MANUAL'])
  collectionMethod?: 'SNMP' | 'MANUAL';

  /** Assigns/overrides which SNMP v3 credential set this printer authenticates with — takes priority over the owning Agent's default. Pass null to clear the override and fall back to the Agent's default (or v1/v2c). */
  @IsOptional()
  @IsString()
  snmpV3CredentialId?: string | null;
}
