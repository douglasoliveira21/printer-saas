import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

export enum AccountTypeDto {
  STAFF = 'STAFF',
  CUSTOMER = 'CUSTOMER',
}

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
  @IsEnum(AccountTypeDto)
  accountType?: AccountTypeDto;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  /** Required when accountType=CUSTOMER — creates a customer-portal user (spec §34) scoped to this customer. */
  @ValidateIf((dto) => dto.accountType === AccountTypeDto.CUSTOMER)
  @IsUUID()
  customerId?: string;

  /** Direct permission grants (Permission.key), assigned by the account-type checklist instead of a Role. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];

  /** Only meaningful for accountType=STAFF. Defaults to true (see all customers) when omitted. */
  @IsOptional()
  @IsBoolean()
  viewAllCustomers?: boolean;

  /** Customers this account may see when viewAllCustomers=false. */
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  visibleCustomerIds?: string[];

  @IsOptional()
  @IsBoolean()
  notifyTicketAssigned?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyTicketSlaExpiring?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyTicketSlaBreached?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyTicketClosed?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyTicketCommented?: boolean;
}
