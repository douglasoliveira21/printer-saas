import { IsEmail } from 'class-validator';

export class CreateReportEmailRecipientDto {
  @IsEmail()
  email!: string;
}
