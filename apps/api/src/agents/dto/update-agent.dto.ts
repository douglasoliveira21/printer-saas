import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateAgentDto {
  @IsString()
  @MinLength(2)
  name!: string;

  /** Fallback SNMP v3 credential for printers under this Agent with no per-printer override. Pass null to clear it (falls back to v1/v2c). */
  @IsOptional()
  @IsString()
  defaultSnmpV3CredentialId?: string | null;
}
