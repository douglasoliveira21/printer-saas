import { IsOptional, IsString } from 'class-validator';

export class UpdatePlatformEmailSettingsDto {
  @IsOptional()
  @IsString()
  m365ClientId?: string;

  /** Left out of the DTO entirely (not even undefined) means "keep the current secret". */
  @IsOptional()
  @IsString()
  m365ClientSecret?: string;
}
