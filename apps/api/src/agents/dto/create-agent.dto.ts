import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}
