import { IsIn, IsOptional } from 'class-validator';

export class ListReplacementsQueryDto {
  @IsOptional()
  @IsIn(['PREDICTED', 'CONFIRMED', 'PREMATURE', 'DISMISSED'])
  status?: string;
}
