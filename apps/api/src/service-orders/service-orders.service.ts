import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import { resolveSlaHours } from '@printer-saas/shared';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryMovementTypeDto } from '../inventory/dto/create-movement.dto';
import { paginated } from '../common/dto/pagination.dto';
import type { CreateServiceOrderDto } from './dto/create-service-order.dto';
import type { UpdateServiceOrderDto } from './dto/update-service-order.dto';
import type { ListServiceOrdersQueryDto } from './dto/list-service-orders-query.dto';
import type { AddPartDto } from './dto/add-part.dto';
import type { ApproveServiceOrderDto } from './dto/approve-service-order.dto';
import type { ServiceOrderPhotoPhaseDto } from './dto/upload-photo.dto';
import type { AuthenticatedUser } from '../auth/types';

export const NOTIFICATIONS_QUEUE = 'notifications';

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberta',
  SCHEDULED: 'Aguardando atendimento',
  IN_PROGRESS: 'Em atendimento',
  WAITING_PART: 'Aguardando peça',
  WAITING_CUSTOMER: 'Aguardando cliente',
  DONE: 'Resolvida',
  CANCELLED: 'Cancelada',
};

const PRIORITY_LABEL: Record<string, string> = { LOW: 'Baixa', MEDIUM: 'Normal', HIGH: 'Alta', URGENT: 'Urgente' };

const SERVICE_TYPE_LABEL: Record<string, string> = {
  CORRECTIVE_MAINTENANCE: 'Manutenção corretiva',
  PREVENTIVE_MAINTENANCE: 'Manutenção preventiva',
  INSTALLATION: 'Instalação',
  EQUIPMENT_REPLACEMENT: 'Troca de equipamento',
  DELIVERY_PICKUP: 'Entrega/retirada',
  PRINT_ISSUE: 'Problema de impressão',
  CONFIGURATION: 'Configuração',
  TECHNICAL_SUPPORT: 'Suporte técnico',
  OTHER: 'Outro',
};

const BILLING_TYPE_LABEL: Record<string, string> = {
  CONTRACT: 'Incluso no contrato',
  CHARGE_CUSTOMER: 'Cobrar cliente',
  WARRANTY: 'Garantia',
  COURTESY: 'Cortesia',
};

@Injectable()
export class ServiceOrdersService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly inventoryService: InventoryService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly notificationsQueue: Queue,
  ) {}

  async create(dto: CreateServiceOrderDto, createdByUserId: string | undefined) {
    const customer = await this.assertCustomerBelongsToTenant(dto.customerId);
    const location = dto.locationId ? await this.assertBelongsToTenant('location', dto.locationId) : null;
    const printer = dto.printerId ? await this.assertBelongsToTenant('printer', dto.printerId) : null;
    if (dto.technicianId) await this.assertBelongsToTenant('user', dto.technicianId);

    // Per-tenant sequential number. Race-safe enough for MVP volume via a
    // serializable retry would be ideal, but a simple max+1 inside the
    // client's own tenant scope is fine at this scale — revisit with a
    // DB sequence per tenant if concurrent OS creation becomes common.
    const last = await this.tenantPrisma.client.serviceOrder.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    const startsAt = dto.scheduledAt ? new Date(dto.scheduledAt) : new Date();
    const slaDueAt = dto.slaDueAt ? new Date(dto.slaDueAt) : await this.computeSlaDueAt(startsAt, customer, location, printer, dto.printerId);

    // Auto-fill "contador atual" from the printer's most recent reading, if any.
    let counterAtOpening: number | undefined;
    if (dto.printerId) {
      const latestCounter = await this.tenantPrisma.client.counterReading.findFirst({
        where: { printerId: dto.printerId },
        orderBy: { collectedAt: 'desc' },
        select: { total: true },
      });
      counterAtOpening = latestCounter?.total ?? undefined;
    }

    const created = await this.tenantPrisma.client.serviceOrder.create({
      data: {
        number: (last?.number ?? 0) + 1,
        customerId: dto.customerId,
        locationId: dto.locationId,
        printerId: dto.printerId,
        technicianId: dto.technicianId,
        createdByUserId,
        type: dto.type,
        serviceType: dto.serviceType,
        priority: dto.priority,
        description: dto.description,
        symptoms: dto.symptoms ?? [],
        counterAtOpening,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        slaDueAt,
      } as any,
    });

    if (dto.technicianId) {
      void this.notificationsQueue.add('ticket-assigned', {
        tenantId: this.tenantPrisma.tenantId,
        serviceOrderId: created.id,
        serviceOrderNumber: created.number,
        technicianId: dto.technicianId,
        customerId: dto.customerId,
      });
    }

    return created;
  }

  /** Resolves the applicable SLA (printer > location > customer > contract) and turns it into a due date, or null if none applies. */
  private async computeSlaDueAt(
    from: Date,
    customer: { id: string; slaHours: number | null },
    location: { slaHours: number | null } | null,
    printer: { slaHours: number | null } | null,
    printerId: string | undefined,
  ) {
    const contract = await this.tenantPrisma.client.contract.findFirst({
      where: {
        customerId: customer.id,
        OR: printerId ? [{ printerId }, { printerId: null }] : [{ printerId: null }],
        status: 'ACTIVE',
      },
      orderBy: { printerId: 'desc' }, // printer-specific contracts (non-null) sort first
      select: { slaHours: true },
    });

    const slaHours = resolveSlaHours({
      printerSlaHours: printer?.slaHours,
      locationSlaHours: location?.slaHours,
      customerSlaHours: customer.slaHours,
      contractSlaHours: contract?.slaHours,
    });

    return slaHours === null ? undefined : new Date(from.getTime() + slaHours * 60 * 60 * 1000);
  }

  async findAll(query: ListServiceOrdersQueryDto) {
    const where = {
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.technicianId ? { technicianId: query.technicianId } : {}),
    };

    const [data, total] = await Promise.all([
      this.tenantPrisma.client.serviceOrder.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, legalName: true, tradeName: true } },
          location: { select: { id: true, name: true } },
          printer: { select: { id: true, model: true, ip: true } },
          technician: { select: { id: true, name: true } },
        },
      }),
      this.tenantPrisma.client.serviceOrder.count({ where }),
    ]);

    return paginated(data, total, query);
  }

  async findOne(id: string) {
    const serviceOrder = await this.tenantPrisma.client.serviceOrder.findFirst({
      where: { id },
      include: {
        customer: true,
        location: true,
        printer: true,
        technician: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        parts: { orderBy: { createdAt: 'asc' } },
        photos: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!serviceOrder) {
      throw new NotFoundException('Ordem de serviço não encontrada');
    }
    return serviceOrder;
  }

  async update(id: string, dto: UpdateServiceOrderDto, user?: AuthenticatedUser) {
    const before = await this.findOne(id);
    if (dto.technicianId) await this.assertBelongsToTenant('user', dto.technicianId);

    const isClosing = dto.status === 'DONE' && before.status !== 'DONE';
    if (isClosing && user && !user.isSuperAdmin && !user.permissions.includes('service_orders.close')) {
      throw new ForbiddenException('Missing permission: service_orders.close');
    }

    const data: Record<string, unknown> = { ...dto };
    if (dto.scheduledAt) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.slaDueAt) data.slaDueAt = new Date(dto.slaDueAt);
    if (dto.startedAt) data.startedAt = new Date(dto.startedAt);
    if (dto.completedAt) data.completedAt = new Date(dto.completedAt);
    if (dto.arrivedAt) data.arrivedAt = new Date(dto.arrivedAt);
    if (dto.departedAt) data.departedAt = new Date(dto.departedAt);

    // Convenience: moving into IN_PROGRESS/DONE stamps the timestamp if the
    // caller didn't supply one explicitly, so the UI doesn't have to.
    if (dto.status === 'IN_PROGRESS' && !dto.startedAt) data.startedAt = new Date();
    if (dto.status === 'DONE' && !dto.completedAt) data.completedAt = new Date();

    const updated = await this.tenantPrisma.client.serviceOrder.update({ where: { id }, data: data as any });

    // Fire-and-forget notifications — enqueued on the same BullMQ queue the
    // worker already consumes for the closings digest (see
    // apps/worker/src/jobs/closing-digest.processor.ts). A queue failure
    // must never fail the actual OS update, so this is deliberately not
    // awaited-and-thrown; BullMQ's own retry handles transient Redis blips.
    const wasAssigned = dto.technicianId && dto.technicianId !== before.technicianId;
    if (wasAssigned) {
      void this.notificationsQueue.add('ticket-assigned', {
        tenantId: this.tenantPrisma.tenantId,
        serviceOrderId: id,
        serviceOrderNumber: updated.number,
        technicianId: dto.technicianId,
        customerId: before.customerId,
      });
    }
    if (isClosing) {
      void this.notificationsQueue.add('ticket-closed', {
        tenantId: this.tenantPrisma.tenantId,
        serviceOrderId: id,
        serviceOrderNumber: updated.number,
        createdByUserId: before.createdByUserId,
        customerId: before.customerId,
      });
    }

    return updated;
  }

  // ---------------------------------------------------------------------
  // Parts / materials
  // ---------------------------------------------------------------------

  async addPart(serviceOrderId: string, dto: AddPartDto) {
    await this.findOne(serviceOrderId);

    let inventoryMovementId: string | undefined;
    if (dto.inventoryItemId) {
      const movement = await this.inventoryService.createMovement(dto.inventoryItemId, {
        type: InventoryMovementTypeDto.OUT,
        quantity: dto.quantity,
        reason: `Usado na OS`,
        serviceOrderId,
      });
      inventoryMovementId = movement.id;
    }

    return this.tenantPrisma.client.serviceOrderPart.create({
      data: {
        serviceOrderId,
        name: dto.name,
        quantity: dto.quantity,
        unitValue: dto.unitValue,
        inventoryItemId: dto.inventoryItemId,
        inventoryMovementId,
      } as any,
    });
  }

  async removePart(serviceOrderId: string, partId: string) {
    const part = await this.tenantPrisma.client.serviceOrderPart.findFirst({ where: { id: partId, serviceOrderId } });
    if (!part) {
      throw new NotFoundException('Peça não encontrada');
    }
    await this.tenantPrisma.client.serviceOrderPart.delete({ where: { id: partId } });
  }

  // ---------------------------------------------------------------------
  // Photos
  // ---------------------------------------------------------------------

  async addPhoto(serviceOrderId: string, phase: ServiceOrderPhotoPhaseDto, relativePath: string) {
    await this.findOne(serviceOrderId);
    return this.tenantPrisma.client.serviceOrderPhoto.create({
      data: { serviceOrderId, phase, path: relativePath } as any,
    });
  }

  async removePhoto(serviceOrderId: string, photoId: string) {
    const photo = await this.tenantPrisma.client.serviceOrderPhoto.findFirst({ where: { id: photoId, serviceOrderId } });
    if (!photo) {
      throw new NotFoundException('Foto não encontrada');
    }
    await this.tenantPrisma.client.serviceOrderPhoto.delete({ where: { id: photoId } });
    try {
      await unlink(join(process.cwd(), 'uploads', photo.path));
    } catch {
      // File already gone from disk — the DB row is the source of truth for the UI either way.
    }
  }

  // ---------------------------------------------------------------------
  // Client approval
  // ---------------------------------------------------------------------

  async approve(serviceOrderId: string, dto: ApproveServiceOrderDto) {
    await this.findOne(serviceOrderId);
    return this.tenantPrisma.client.serviceOrder.update({
      where: { id: serviceOrderId },
      data: {
        approvalName: dto.approvalName,
        approvalSignature: dto.approvalSignature,
        approvalNotes: dto.approvalNotes,
        approvalAt: new Date(),
      },
    });
  }

  async generatePdf(id: string): Promise<Buffer> {
    const so = await this.findOne(id);

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const customerName = (so.customer as any).tradeName || (so.customer as any).legalName;

    doc.fontSize(18).text(`Ordem de Serviço #${so.number}`, { align: 'left' });
    doc.fontSize(10).fillColor('gray').text(`Aberta em ${so.createdAt.toLocaleString('pt-BR')}`);
    doc.fillColor('black').moveDown();

    doc.fontSize(12).text('1. Abertura', { underline: true });
    doc.fontSize(10).text(`Cliente: ${customerName}`);
    if (so.location) doc.text(`Unidade/filial: ${(so.location as any).name}`);
    if (so.printer) doc.text(`Equipamento: ${(so.printer as any).manufacturer ?? ''} ${(so.printer as any).model ?? ''}`.trim());
    if (so.technician) doc.text(`Técnico responsável: ${(so.technician as any).name}`);
    if (so.createdBy) doc.text(`Aberta por: ${(so.createdBy as any).name}`);
    doc.text(`Tipo de atendimento: ${so.serviceType ? SERVICE_TYPE_LABEL[so.serviceType] : 'Não informado'}`);
    doc.text(`Prioridade: ${PRIORITY_LABEL[so.priority]}`);
    doc.moveDown();

    doc.fontSize(12).text('2. Problema / Solicitação', { underline: true });
    doc.fontSize(10).text(`Descrição: ${so.description ?? 'Não informado'}`);
    if (so.symptoms.length > 0) doc.text(`Sintomas: ${so.symptoms.join(', ')}`);
    if (so.counterAtOpening !== null) doc.text(`Contador na abertura: ${so.counterAtOpening} páginas`);
    doc.moveDown();

    doc.fontSize(12).text('3. Diagnóstico técnico', { underline: true });
    doc.fontSize(10);
    if (so.diagnosis) doc.text(`Diagnóstico: ${so.diagnosis}`);
    if (so.causeIdentified) doc.text(`Causa identificada: ${so.causeIdentified}`);
    if (so.testsPerformed) doc.text(`Testes realizados: ${so.testsPerformed}`);
    if (so.defectiveParts) doc.text(`Peças com problema: ${so.defectiveParts}`);
    if (so.suppliesUsed) doc.text(`Suprimentos utilizados: ${so.suppliesUsed}`);
    if (so.technicalNotes) doc.text(`Observações técnicas: ${so.technicalNotes}`);
    doc.moveDown();

    doc.fontSize(12).text('4. Peças e materiais', { underline: true });
    doc.fontSize(10);
    let materialsTotal = 0;
    for (const part of so.parts as any[]) {
      const lineTotal = part.quantity * Number(part.unitValue);
      materialsTotal += lineTotal;
      doc.text(`${part.name} — Qtd: ${part.quantity} — Unit: R$ ${Number(part.unitValue).toFixed(2)} — Total: R$ ${lineTotal.toFixed(2)}`);
    }
    const laborCost = Number(so.laborCost ?? 0);
    const travelCost = Number(so.travelCost ?? 0);
    doc.text(`Materiais: R$ ${materialsTotal.toFixed(2)}`);
    doc.text(`Mão de obra: R$ ${laborCost.toFixed(2)}`);
    doc.text(`Deslocamento: R$ ${travelCost.toFixed(2)}`);
    doc.fontSize(11).text(`Total: R$ ${(materialsTotal + laborCost + travelCost).toFixed(2)}`);
    doc.fontSize(10).text(`Cobrança: ${so.billingType ? BILLING_TYPE_LABEL[so.billingType] : 'Não informado'}`);
    doc.moveDown();

    doc.fontSize(12).text('5. Atendimento do técnico', { underline: true });
    doc.fontSize(10);
    if (so.arrivedAt) doc.text(`Chegada: ${so.arrivedAt.toLocaleString('pt-BR')}`);
    if (so.departedAt) doc.text(`Saída: ${so.departedAt.toLocaleString('pt-BR')}`);
    if (so.mileageKm !== null) doc.text(`Quilometragem: ${so.mileageKm} km`);
    if (so.activityPerformed) doc.text(`Atividade realizada: ${so.activityPerformed}`);
    if (so.attendanceNotes) doc.text(`Observações: ${so.attendanceNotes}`);
    doc.moveDown();

    for (const photo of so.photos as any[]) {
      const filePath = join(process.cwd(), 'uploads', photo.path);
      if (existsSync(filePath)) {
        doc.fontSize(9).text(photo.phase === 'BEFORE' ? 'Foto antes' : 'Foto depois');
        try {
          doc.image(filePath, { width: 200 });
        } catch {
          // unreadable/corrupt image — skip rather than fail the whole PDF
        }
        doc.moveDown(0.5);
      }
    }

    doc.fontSize(12).text('6. Resultado', { underline: true });
    doc.fontSize(10).text(`Status: ${STATUS_LABEL[so.status]}`);
    if (so.solution) doc.text(`Solução aplicada: ${so.solution}`);
    if (so.equipmentWorking !== null) doc.text(`Equipamento funcionando: ${so.equipmentWorking ? 'Sim' : 'Não'}`);
    doc.moveDown();

    doc.fontSize(12).text('7. Aprovação do cliente', { underline: true });
    doc.fontSize(10);
    if (so.approvalName) {
      doc.text(`Confirmado por: ${so.approvalName}`);
      if (so.approvalAt) doc.text(`Data/hora: ${so.approvalAt.toLocaleString('pt-BR')}`);
      if (so.approvalNotes) doc.text(`Observação do cliente: ${so.approvalNotes}`);
      if (so.approvalSignature?.startsWith('data:image')) {
        try {
          const base64 = so.approvalSignature.split(',')[1];
          doc.image(Buffer.from(base64, 'base64'), { width: 200 });
        } catch {
          // malformed signature data — omit rather than fail the whole PDF
        }
      }
    } else {
      doc.text('Ainda não aprovada pelo cliente.');
    }

    doc.end();
    return done;
  }

  private async assertCustomerBelongsToTenant(customerId: string) {
    const customer = await this.tenantPrisma.client.customer.findFirst({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return customer;
  }

  private async assertBelongsToTenant(model: 'location' | 'printer' | 'user', id: string) {
    const record = await (this.tenantPrisma.client[model] as any).findFirst({ where: { id } });
    if (!record) {
      throw new NotFoundException(`Registro (${model}) não encontrado`);
    }
    return record;
  }
}
