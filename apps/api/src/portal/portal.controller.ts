import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PortalService } from './portal.service';
import { PortalGuard } from './portal.guard';
import { CreatePortalServiceOrderDto } from './dto/create-portal-service-order.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';

/**
 * Customer-portal endpoints (spec §34): a customer's own user sees only
 * their own printers/OS/contracts. Guarded by PortalGuard instead of the
 * usual RBAC permissions, since a portal user isn't tenant staff.
 */
@ApiTags('portal')
@Controller('portal')
@UseGuards(PortalGuard)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('printers')
  printers(@CurrentUser() user: AuthenticatedUser) {
    return this.portalService.printers(user.customerId!);
  }

  @Get('printers/:id')
  printer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.portalService.printer(user.customerId!, id);
  }

  @Get('service-orders')
  serviceOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.portalService.serviceOrders(user.customerId!);
  }

  @Post('service-orders')
  @HttpCode(HttpStatus.CREATED)
  createServiceOrder(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePortalServiceOrderDto) {
    return this.portalService.createServiceOrder(user.customerId!, dto);
  }

  @Get('contracts')
  contracts(@CurrentUser() user: AuthenticatedUser) {
    return this.portalService.contracts(user.customerId!);
  }
}
