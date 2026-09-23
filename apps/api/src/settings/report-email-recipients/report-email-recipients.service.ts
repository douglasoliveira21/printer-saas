import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import type { CreateReportEmailRecipientDto } from './dto/create-report-email-recipient.dto';

/**
 * Tenant-wide list of who receives the daily closing digest e-mail (spec:
 * "resumos diários de fechamentos") — replaces the old per-contract
 * ContractEmailRecipient for this purpose. A contract's own "E-mail" tab
 * only displays this list read-only; it's edited here.
 */
@Injectable()
export class ReportEmailRecipientsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  findAll() {
    return this.tenantPrisma.client.reportEmailRecipient.findMany({ orderBy: { createdAt: 'asc' } });
  }

  create(dto: CreateReportEmailRecipientDto) {
    return this.tenantPrisma.client.reportEmailRecipient.create({ data: dto as any });
  }

  async remove(id: string) {
    const recipient = await this.tenantPrisma.client.reportEmailRecipient.findFirst({ where: { id } });
    if (!recipient) {
      throw new NotFoundException('Destinatário não encontrado');
    }
    await this.tenantPrisma.client.reportEmailRecipient.delete({ where: { id } });
    return { removed: true };
  }
}
