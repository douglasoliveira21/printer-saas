import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreatePortalServiceOrderDto {
  @IsOptional()
  @IsUUID()
  printerId?: string;

  @IsString()
  @MinLength(5)
  description!: string;
}
