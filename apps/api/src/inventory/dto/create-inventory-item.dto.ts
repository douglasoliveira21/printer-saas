import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minQuantity?: number;
}
