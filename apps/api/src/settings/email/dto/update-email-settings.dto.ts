import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

enum EmailProviderDto {
  SMTP = 'SMTP',
  MICROSOFT365 = 'MICROSOFT365',
}

export class UpdateEmailSettingsDto {
  @IsOptional()
  @IsEnum(EmailProviderDto)
  provider?: EmailProviderDto;

  @IsOptional()
  @IsString()
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  smtpPort?: number;

  @IsOptional()
  @IsString()
  smtpUser?: string;

  /** Left out of the DTO entirely (not even undefined) means "keep the current password". */
  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @IsOptional()
  @IsEmail()
  smtpFrom?: string;
}
