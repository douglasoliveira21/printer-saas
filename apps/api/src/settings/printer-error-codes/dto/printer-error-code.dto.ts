import { IsEnum, IsString, MinLength } from 'class-validator';

enum AlertLevelDto {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export class CreatePrinterErrorCodeDto {
  @IsString()
  @MinLength(1)
  manufacturer!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsEnum(AlertLevelDto)
  severity!: AlertLevelDto;
}

export class UpdatePrinterErrorCodeDto extends CreatePrinterErrorCodeDto {}
