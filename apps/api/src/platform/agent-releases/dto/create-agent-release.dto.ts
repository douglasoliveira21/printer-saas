import { IsBoolean, IsOptional, IsString, IsUrl, Matches, MinLength } from 'class-validator';

export class CreateAgentReleaseDto {
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'version deve ser SemVer (ex.: 1.1.0)' })
  version!: string;

  @IsUrl({ require_tld: false })
  downloadUrl!: string;

  @IsString()
  @Matches(/^[0-9a-f]{64}$/i, { message: 'sha256 deve ser o hash hexadecimal (64 caracteres) do .msi' })
  sha256!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  signingCertThumbprint?: string;

  @IsOptional()
  @IsString()
  releaseNotes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
