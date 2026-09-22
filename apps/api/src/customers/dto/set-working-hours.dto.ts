import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class WorkingHourEntryDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime deve estar no formato HH:mm' })
  startTime!: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'endTime deve estar no formato HH:mm' })
  endTime!: string;
}

export class SetWorkingHoursDto {
  @IsArray()
  @ArrayMaxSize(21) // 3 faixas por dia, 7 dias — generoso o suficiente sem permitir uma lista absurda
  @ValidateNested({ each: true })
  @Type(() => WorkingHourEntryDto)
  hours!: WorkingHourEntryDto[];
}
