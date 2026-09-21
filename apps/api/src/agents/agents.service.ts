import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import type { Agent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { CreateAgentDto } from './dto/create-agent.dto';
import type { EnrollAgentDto, HeartbeatDto, SubmitDevicesDto } from './dto/agent-payloads.dto';

const ENROLLMENT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
// A level jump this large between consecutive readings can't be explained by
// normal usage (levels only go down between polls) — treat it as a physical swap.
const REPLACEMENT_JUMP_THRESHOLD = 40;
// Swapped while still above this level = likely premature (wasted remaining life).
const PREMATURE_REPLACEMENT_LEVEL = 25;

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Tenant-admin action: pre-register an Agent slot and hand out a one-time enrollment token. */
  async createEnrollment(dto: CreateAgentDto) {
    const token = randomBytes(16).toString('hex').toUpperCase();
    // tenantId is injected at runtime by the tenant-scoped Prisma extension.
    const agent = await this.tenantPrisma.client.agent.create({
      data: {
        name: dto.name,
        locationId: dto.locationId,
        enrollmentToken: token,
        enrollmentTokenExpiresAt: new Date(Date.now() + ENROLLMENT_TOKEN_TTL_MS),
        status: 'PENDING',
      } as any,
    });
    return { agentId: agent.id, enrollmentToken: token, expiresAt: agent.enrollmentTokenExpiresAt };
  }

  findAll() {
    return this.tenantPrisma.client.agent.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async rename(id: string, name: string) {
    await this.assertExists(id);
    return this.tenantPrisma.client.agent.update({ where: { id }, data: { name } });
  }

  async remove(id: string) {
    await this.assertExists(id);
    // Printers stay (they're independent equipment records — spec §70 never
    // deletes discovery/counter history just because the Agent that found
    // them is gone); only the Agent slot itself is removed.
    await this.tenantPrisma.client.agent.delete({ where: { id } });
  }

  /** Re-issues a fresh one-time token for an Agent that never completed enrollment (e.g. the old one expired). */
  async regenerateToken(id: string) {
    const agent = await this.assertExists(id);
    if (agent.status !== 'PENDING') {
      throw new BadRequestException('Este Agent já foi enrollado — não é possível gerar um novo token de instalação para ele');
    }
    const token = randomBytes(16).toString('hex').toUpperCase();
    const updated = await this.tenantPrisma.client.agent.update({
      where: { id },
      data: { enrollmentToken: token, enrollmentTokenExpiresAt: new Date(Date.now() + ENROLLMENT_TOKEN_TTL_MS) },
    });
    return { agentId: updated.id, enrollmentToken: token, expiresAt: updated.enrollmentTokenExpiresAt };
  }

  private async assertExists(id: string) {
    const agent = await this.tenantPrisma.client.agent.findFirst({ where: { id } });
    if (!agent) {
      throw new NotFoundException('Agent não encontrado');
    }
    return agent;
  }

  /** Public: the Windows Agent redeems its one-time token for a permanent API key. */
  async enroll(dto: EnrollAgentDto) {
    const agent = await this.prisma.agent.findUnique({ where: { enrollmentToken: dto.enrollmentToken } });
    if (!agent || !agent.enrollmentTokenExpiresAt || agent.enrollmentTokenExpiresAt < new Date()) {
      throw new UnauthorizedException('Token de instalação inválido ou expirado');
    }

    const secret = randomBytes(32).toString('hex');
    const apiKeyHash = await argon2.hash(secret);

    await this.prisma.agent.update({
      where: { id: agent.id },
      data: {
        apiKeyHash,
        enrollmentToken: null,
        enrollmentTokenExpiresAt: null,
        hostname: dto.hostname,
        agentVersion: dto.agentVersion,
        status: 'ONLINE',
        lastHeartbeatAt: new Date(),
      },
    });

    return { agentId: agent.id, apiKey: `${agent.id}.${secret}` };
  }

  async heartbeat(agent: Agent, dto: HeartbeatDto) {
    await this.prisma.agent.update({
      where: { id: agent.id },
      data: {
        hostname: dto.hostname ?? agent.hostname,
        osVersion: dto.osVersion ?? agent.osVersion,
        localIp: dto.localIp ?? agent.localIp,
        agentVersion: dto.agentVersion ?? agent.agentVersion,
        status: 'ONLINE',
        lastHeartbeatAt: new Date(),
      },
    });
    return { ok: true };
  }

  async getConfig(agent: Agent) {
    return { discoveryConfig: agent.discoveryConfig ?? null };
  }

  /**
   * Normalized device payload from the Agent. Creates a `DISCOVERED` printer
   * on first sighting (never auto-claims it for a customer/contract — see
   * spec §23) or, for a known printer, appends counter/consumable history
   * and resolves IP churn via fingerprint dedup (see §68-69).
   */
  async submitDevices(agent: Agent, dto: SubmitDevicesDto) {
    const results = [];
    for (const device of dto.devices) {
      const fingerprint = this.computeFingerprint(agent.id, device);
      if (!fingerprint) {
        continue;
      }

      const printer = await this.prisma.printer.upsert({
        where: { tenantId_fingerprint: { tenantId: agent.tenantId, fingerprint } },
        create: {
          tenantId: agent.tenantId,
          agentId: agent.id,
          fingerprint,
          ip: device.ip,
          mac: device.mac,
          hostname: device.hostname,
          serial: device.serial,
          manufacturer: device.manufacturer,
          model: device.model,
          firmware: device.firmware,
          sysDescr: device.sysDescr,
          status: 'DISCOVERED',
          onlineStatus: 'ONLINE',
          collectionMethod: device.collectionMethod ?? 'SNMP',
          lastSeenAt: new Date(),
          lastCollectedAt: new Date(),
        },
        update: {
          // IP may have changed (§69) — identity is the fingerprint, not the IP.
          ip: device.ip,
          mac: device.mac ?? undefined,
          hostname: device.hostname ?? undefined,
          manufacturer: device.manufacturer ?? undefined,
          model: device.model ?? undefined,
          firmware: device.firmware ?? undefined,
          sysDescr: device.sysDescr ?? undefined,
          onlineStatus: 'ONLINE',
          collectionMethod: device.collectionMethod ?? undefined,
          lastSeenAt: new Date(),
          lastCollectedAt: new Date(),
        },
      });

      if (device.counters) {
        await this.prisma.counterReading.create({
          data: {
            printerId: printer.id,
            total: device.counters.total,
            blackWhite: device.counters.blackWhite,
            color: device.counters.color,
            copies: device.counters.copies,
            raw: device.counters.raw as any,
          },
        });
      }

      if (device.consumables?.length) {
        for (const c of device.consumables) {
          const levelPercent = c.levelPercent !== undefined ? Math.round(c.levelPercent) : undefined;
          if (levelPercent !== undefined) {
            await this.detectReplacement(agent.tenantId, printer.id, c.type, c.color ?? null, levelPercent);
          }
          await this.prisma.consumableReading.create({
            data: {
              printerId: printer.id,
              type: c.type,
              color: c.color,
              levelPercent,
              capacity: c.capacity,
              name: c.name,
              serial: c.serial,
            },
          });
        }
      }

      results.push({ fingerprint, printerId: printer.id, status: printer.status });
    }
    return { processed: results.length, results };
  }

  /**
   * A physical consumable swap shows up as the level jumping back up between
   * two consecutive readings (levels only ever fall between agent polls
   * otherwise). Confirms/creates a ConsumableReplacement record when that
   * happens, flagging it PREMATURE if there was still plenty of life left.
   */
  private async detectReplacement(tenantId: string, printerId: string, type: string, color: string | null, newLevel: number) {
    const previous = await this.prisma.consumableReading.findFirst({
      where: { printerId, type, color },
      orderBy: { collectedAt: 'desc' },
      select: { levelPercent: true },
    });
    if (previous?.levelPercent === null || previous?.levelPercent === undefined) return;
    if (newLevel - previous.levelPercent < REPLACEMENT_JUMP_THRESHOLD) return;

    const status = previous.levelPercent > PREMATURE_REPLACEMENT_LEVEL ? 'PREMATURE' : 'CONFIRMED';
    const updated = await this.prisma.consumableReplacement.updateMany({
      where: { printerId, type, color, status: 'PREDICTED' },
      data: { status, replacedAt: new Date(), levelPercentAtReplacement: previous.levelPercent },
    });
    if (updated.count === 0) {
      await this.prisma.consumableReplacement.create({
        data: { tenantId, printerId, type, color, replacedAt: new Date(), levelPercentAtReplacement: previous.levelPercent, status },
      });
    }
  }

  private computeFingerprint(agentId: string, device: { serial?: string; mac?: string; ip?: string }): string | null {
    // Priority: serial (most stable) > MAC > agent+IP (weakest, changes on DHCP renewal).
    if (device.serial) return `serial:${device.serial}`;
    if (device.mac) return `mac:${device.mac}`;
    if (device.ip) return `agent-ip:${agentId}:${device.ip}`;
    return null;
  }

  // ---------------------------------------------------------------------
  // Printer management from the Agent's own ConfigTool (agent-api/v1/printers/*).
  // Scoped to this Agent's own printers only — the Agent has no user JWT/
  // permissions, just its own agentId, so every query below filters on it
  // explicitly rather than going through TenantPrismaService.
  // ---------------------------------------------------------------------

  listPrintersForAgent(agent: Agent) {
    return this.prisma.printer.findMany({
      where: { agentId: agent.id },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async getPrinterForAgent(agent: Agent, id: string) {
    const printer = await this.prisma.printer.findFirst({
      where: { id, agentId: agent.id },
      include: {
        counters: { orderBy: { collectedAt: 'desc' }, take: 20 },
        consumables: { orderBy: { collectedAt: 'desc' }, take: 20 },
      },
    });
    if (!printer) {
      throw new NotFoundException('Impressora não encontrada');
    }
    return printer;
  }

  async monitorPrinters(agent: Agent, ids: string[]) {
    const result = await this.prisma.printer.updateMany({
      where: { id: { in: ids }, agentId: agent.id },
      data: { status: 'MONITORED', monitoredAt: new Date() },
    });
    return { updated: result.count };
  }

  async deactivatePrinters(agent: Agent, ids: string[]) {
    const result = await this.prisma.printer.updateMany({
      where: { id: { in: ids }, agentId: agent.id },
      data: { status: 'IGNORED' },
    });
    return { updated: result.count };
  }

  /**
   * Hard delete — only for a DISCOVERED printer (never claimed/monitored),
   * since a monitored printer may already have ServiceOrder/Contract/Alert
   * rows pointing at it without cascade delete; those must go through the
   * web app's "Decomissionar" (soft, history-preserving) instead.
   */
  async removePrinterForAgent(agent: Agent, id: string) {
    const printer = await this.prisma.printer.findFirst({ where: { id, agentId: agent.id } });
    if (!printer) {
      throw new NotFoundException('Impressora não encontrada');
    }
    if (printer.status !== 'DISCOVERED') {
      throw new BadRequestException(
        'Só é possível remover impressoras ainda não monitoradas. Para retirar uma impressora monitorada, use "Decomissionar" no site.',
      );
    }
    await this.prisma.printer.delete({ where: { id } });
    return { removed: true };
  }

  async markOfflineStale(thresholdSeconds: number) {
    const cutoff = new Date(Date.now() - thresholdSeconds * 1000);
    const [agents, printers] = await Promise.all([
      this.prisma.agent.updateMany({
        where: { status: 'ONLINE', lastHeartbeatAt: { lt: cutoff } },
        data: { status: 'OFFLINE' },
      }),
      this.prisma.printer.updateMany({
        where: { onlineStatus: 'ONLINE', lastSeenAt: { lt: cutoff } },
        data: { onlineStatus: 'OFFLINE' },
      }),
    ]);
    return { agentsMarkedOffline: agents.count, printersMarkedOffline: printers.count };
  }
}
