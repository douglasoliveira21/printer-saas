import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpdateNotificationSettingDto {
  @IsOptional()
  @IsBoolean()
  allCustomers?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  customerIds?: string[];
}
