import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateServiceOrderTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  blankLinesOnPrint?: number;
}

export class UpdateServiceOrderTypeDto extends PartialType(CreateServiceOrderTypeDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
