import { IsArray, IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

enum CustomerEmailFieldDto {
  EMAIL = 'EMAIL',
  FINANCIAL_EMAIL = 'FINANCIAL_EMAIL',
  SUPPORT_EMAIL = 'SUPPORT_EMAIL',
}

export class UpdateReportDeliveryDto {
  @IsOptional()
  @IsBoolean()
  allCustomers?: boolean;

  @IsOptional()
  @IsEnum(CustomerEmailFieldDto)
  emailField?: CustomerEmailFieldDto;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  customerIds?: string[];
}
