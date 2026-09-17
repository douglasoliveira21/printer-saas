import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListPrintersQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['DISCOVERED', 'MONITORED', 'IGNORED', 'DECOMMISSIONED'])
  status?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;
}
