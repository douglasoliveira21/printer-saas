import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

@ApiTags('contracts')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @RequirePermissions('contracts.create')
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Get()
  @RequirePermissions('contracts.view')
  findAll(@Query() pagination: PaginationDto) {
    return this.contractsService.findAll(pagination);
  }

  @Get(':id')
  @RequirePermissions('contracts.view')
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('contracts.edit')
  update(@Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.contractsService.update(id, dto);
  }

  @Get(':id/billing-preview')
  @RequirePermissions('contracts.view')
  billingPreview(@Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (!from || !to) {
      throw new BadRequestException('Parâmetros "from" e "to" são obrigatórios');
    }
    return this.contractsService.billingPreview(id, new Date(from), new Date(to));
  }
}
