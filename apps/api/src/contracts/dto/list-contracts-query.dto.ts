import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListContractsQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'SUSPENDED', 'ENDED', 'EXPIRED'])
  status?: string;
}
