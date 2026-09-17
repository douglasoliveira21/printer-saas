import { IsString, MinLength } from 'class-validator';

export class UpdateAgentDto {
  @IsString()
  @MinLength(2)
  name!: string;
}
