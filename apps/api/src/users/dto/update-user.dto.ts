import { PartialType, OmitType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

enum UserStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  INVITED = 'INVITED',
}

// email is immutable after creation — never in the update surface.
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['email'] as const)) {
  @IsOptional()
  @IsEnum(UserStatusDto)
  status?: UserStatusDto;
}
