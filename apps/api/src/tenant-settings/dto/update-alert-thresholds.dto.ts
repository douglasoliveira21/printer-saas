import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateAlertThresholdsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  agentOfflineThresholdHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  printerOfflineThresholdHours?: number;
}
