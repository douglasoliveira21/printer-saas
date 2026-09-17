import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListServiceOrdersQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['OPEN', 'SCHEDULED', 'IN_PROGRESS', 'WAITING_PART', 'WAITING_CUSTOMER', 'DONE', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;
}
