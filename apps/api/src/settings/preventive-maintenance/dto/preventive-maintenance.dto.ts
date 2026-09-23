import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreatePreventiveMaintenanceScheduleDto {
  @IsUUID()
  printerId!: string;

  @IsInt()
  @Min(1)
  intervalDays!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePreventiveMaintenanceScheduleDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  intervalDays?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
