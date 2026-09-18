import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class GenerateClosingDto {
  @IsUUID()
  customerId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}
