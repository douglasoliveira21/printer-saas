import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ListContractsQueryDto } from './dto/list-contracts-query.dto';
import { CreateContractPrinterDto, UpdateContractPrinterDto } from './dto/contract-printer.dto';
import { CreateContractFixedCostDto } from './dto/contract-fixed-cost.dto';
import { CreateContractEmailDto } from './dto/contract-email.dto';
import { CreateContractReadjustmentDto } from './dto/contract-readjustment.dto';
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
  findAll(@Query() query: ListContractsQueryDto) {
    return this.contractsService.findAll(query);
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

  @Post(':id/printers')
  @RequirePermissions('contracts.edit')
  addPrinter(@Param('id') id: string, @Body() dto: CreateContractPrinterDto) {
    return this.contractsService.addPrinter(id, dto);
  }

  @Patch(':id/printers/:contractPrinterId')
  @RequirePermissions('contracts.edit')
  updatePrinter(@Param('id') id: string, @Param('contractPrinterId') contractPrinterId: string, @Body() dto: UpdateContractPrinterDto) {
    return this.contractsService.updatePrinter(id, contractPrinterId, dto);
  }

  @Delete(':id/printers/:contractPrinterId')
  @RequirePermissions('contracts.edit')
  removePrinter(@Param('id') id: string, @Param('contractPrinterId') contractPrinterId: string) {
    return this.contractsService.removePrinter(id, contractPrinterId);
  }

  @Post(':id/fixed-costs')
  @RequirePermissions('contracts.edit')
  addFixedCost(@Param('id') id: string, @Body() dto: CreateContractFixedCostDto) {
    return this.contractsService.addFixedCost(id, dto);
  }

  @Delete(':id/fixed-costs/:costId')
  @RequirePermissions('contracts.edit')
  removeFixedCost(@Param('id') id: string, @Param('costId') costId: string) {
    return this.contractsService.removeFixedCost(id, costId);
  }

  @Get(':id/emails')
  @RequirePermissions('contracts.view')
  listEmails(@Param('id') id: string) {
    return this.contractsService.listEmails(id);
  }

  @Post(':id/emails')
  @RequirePermissions('contracts.edit')
  addEmail(@Param('id') id: string, @Body() dto: CreateContractEmailDto) {
    return this.contractsService.addEmail(id, dto);
  }

  @Delete(':id/emails/:emailId')
  @RequirePermissions('contracts.edit')
  removeEmail(@Param('id') id: string, @Param('emailId') emailId: string) {
    return this.contractsService.removeEmail(id, emailId);
  }

  @Get(':id/readjustments')
  @RequirePermissions('contracts.view')
  listReadjustments(@Param('id') id: string) {
    return this.contractsService.listReadjustments(id);
  }

  @Post(':id/readjustments')
  @RequirePermissions('contracts.edit')
  createReadjustment(@Param('id') id: string, @Body() dto: CreateContractReadjustmentDto) {
    return this.contractsService.createReadjustment(id, dto);
  }

  @Post(':id/readjustments/:readjustmentId/apply')
  @RequirePermissions('contracts.edit')
  applyReadjustment(@Param('id') id: string, @Param('readjustmentId') readjustmentId: string) {
    return this.contractsService.applyReadjustment(id, readjustmentId);
  }
}
