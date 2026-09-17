import { IsOptional, IsUUID } from 'class-validator';

export class ClaimPrinterDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}
