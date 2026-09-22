import { IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export const SNMP_V3_SECURITY_LEVELS = ['noAuthNoPriv', 'authNoPriv', 'authPriv'] as const;
export const SNMP_V3_AUTH_PROTOCOLS = ['MD5', 'SHA1', 'SHA256', 'SHA384', 'SHA512'] as const;
export const SNMP_V3_PRIV_PROTOCOLS = ['DES', 'AES128', 'AES192', 'AES256'] as const;

export class CreateSnmpCredentialDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  userName!: string;

  @IsIn(SNMP_V3_SECURITY_LEVELS)
  securityLevel!: (typeof SNMP_V3_SECURITY_LEVELS)[number];

  @ValidateIf((dto) => dto.securityLevel !== 'noAuthNoPriv')
  @IsIn(SNMP_V3_AUTH_PROTOCOLS)
  authenticationProtocol?: (typeof SNMP_V3_AUTH_PROTOCOLS)[number];

  @ValidateIf((dto) => dto.securityLevel !== 'noAuthNoPriv')
  @IsString()
  @MinLength(8, { message: 'A senha de autenticação SNMP v3 precisa ter ao menos 8 caracteres' })
  authenticationPassword?: string;

  @ValidateIf((dto) => dto.securityLevel === 'authPriv')
  @IsIn(SNMP_V3_PRIV_PROTOCOLS)
  privacyProtocol?: (typeof SNMP_V3_PRIV_PROTOCOLS)[number];

  @ValidateIf((dto) => dto.securityLevel === 'authPriv')
  @IsString()
  @MinLength(8, { message: 'A senha de privacidade SNMP v3 precisa ter ao menos 8 caracteres' })
  privacyPassword?: string;

  @IsOptional()
  @IsString()
  contextName?: string;
}
