import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListFinancialEntriesQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['RECEIVABLE', 'PAYABLE'])
  type?: string;

  @IsOptional()
  @IsIn(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'])
  status?: string;
}
