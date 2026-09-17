import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateContractDto } from './create-contract.dto';

export enum ContractStatusDto {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  ENDED = 'ENDED',
  EXPIRED = 'EXPIRED',
}

export class UpdateContractDto extends PartialType(CreateContractDto) {
  @IsOptional()
  @IsEnum(ContractStatusDto)
  status?: ContractStatusDto;
}
