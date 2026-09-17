import { IsEnum } from 'class-validator';

export enum TenantStatusDto {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export class UpdateTenantStatusDto {
  @IsEnum(TenantStatusDto)
  status!: TenantStatusDto;
}
