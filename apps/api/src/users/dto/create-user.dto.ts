import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  /** Set to create a customer-portal user (spec §34) instead of tenant staff. */
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
