import { IsOptional, IsUUID } from 'class-validator';

export class AssignPlanDto {
  @IsOptional()
  @IsUUID()
  planId?: string;
}
