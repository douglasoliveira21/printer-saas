import { IsEmail } from 'class-validator';

export class CreateContractEmailDto {
  @IsEmail()
  email!: string;
}
