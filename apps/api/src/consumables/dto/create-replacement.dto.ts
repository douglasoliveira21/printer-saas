import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateReplacementDto {
  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Optional stock item to decrement (creates an OUT movement of 1 unit). */
  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;
}
