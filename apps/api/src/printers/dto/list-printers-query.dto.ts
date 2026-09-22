import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListPrintersQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['DISCOVERED', 'MONITORED', 'IGNORED', 'DECOMMISSIONED'])
  status?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  /**
   * "Novas Impressoras" submenu: restrict to devices discovered by an agent
   * that is actually enrolled (never PENDING) — i.e. clients that already
   * have a working agent installed. Combined with status=DISCOVERED it
   * yields exactly the "new printers found on clients with an agent" list.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  agentEnrolled?: boolean;
}
