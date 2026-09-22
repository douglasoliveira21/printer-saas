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
    // A location always implies its own customer — if only locationId was
    // given (no explicit customerId), derive it so the Agent is still
    // linked at the customer level, not just at the location level.
    let customerId = dto.customerId;
    if (!customerId && dto.locationId) {
      const location = await this.tenantPrisma.client.location.findFirst({ where: { id: dto.locationId } });
      customerId = location?.customerId;
    }
    // tenantId is injected at runtime by the tenant-scoped Prisma extension.
    const agent = await this.tenantPrisma.client.agent.create({
      data: {
        name: dto.name,
        customerId,
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

  /**
   * Re-issues a fresh one-time install token — for an Agent that never
   * finished enrolling (e.g. the old token expired), or to reconfigure/
   * reinstall one that's already ONLINE/OFFLINE (its current apiKeyHash
   * stays valid until a new enroll() call overwrites it, but the Agent
   * goes back to PENDING here so the operator always has a real, working
   * token to copy for this customer instead of hitting a dead end once a
   * device has ever enrolled once).
   */
  async regenerateToken(id: string) {
    await this.assertExists(id);
    const token = randomBytes(16).toString('hex').toUpperCase();
    const updated = await this.tenantPrisma.client.agent.update({
      where: { id },
      data: {
        enrollmentToken: token,
        enrollmentTokenExpiresAt: new Date(Date.now() + ENROLLMENT_TOKEN_TTL_MS),
        status: 'PENDING',
      },
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
      // Server-side re-validation of the Agent's own classification —
      // never just trust the client. Manual/USB additions (AddPrinterDialog,
      // UsbPrinterDiscoveryService) don't run the classifier at all and
      // omit deviceType entirely, which stays allowed (the operator already
      // confirmed by hand it's a printer). Only an EXPLICIT non-printer
      // classification is rejected.
      const PRINT_CAPABLE_TYPES = ['PRINTER', 'MFP', 'PLOTTER'];
      if (device.deviceType && !PRINT_CAPABLE_TYPES.includes(device.deviceType)) {
        continue;
      }

      const fingerprint = this.computeFingerprint(agent.id, device);
      if (!fingerprint) {
        continue;
      }

      // capabilities.a3 (new, generalized) takes priority over the legacy
      // standalone supportsA3 flag when both are present — same value
      // either way in practice, this just keeps one source of truth.
      const supportsA3 = device.capabilities?.a3 ?? device.supportsA3 ?? undefined;
      const capabilities = device.capabilities ? (device.capabilities as any) : undefined;

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
          supportsA3,
          deviceType: (device.deviceType as any) ?? undefined,
          classificationConfidence: device.classificationConfidence ?? undefined,
          capabilities,
          capabilitySources: (device.capabilitySources as any) ?? undefined,
          discoveryDiagnostics: (device.diagnostics as any) ?? undefined,
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
          // Only overwrite when this scan actually determined it — a scan
          // that couldn't read the input tray table this round shouldn't
          // erase a previously-confirmed true/false (spec §67: absence of
          // new data isn't the same as "unknown").
          supportsA3,
          deviceType: (device.deviceType as any) ?? undefined,
          classificationConfidence: device.classificationConfidence ?? undefined,
          capabilities,
          capabilitySources: (device.capabilitySources as any) ?? undefined,
          discoveryDiagnostics: (device.diagnostics as any) ?? undefined,
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
  /**
   * DISCOVERED/IGNORED are both "never claimed" states — a printer only
   * gets a customerId via claim() (printers.service.ts), which always sets
   * status to MONITORED in the same call. So neither state can legitimately
   * have a customer/contract attached; MONITORED/DECOMMISSIONED can, and
   * stay blocked here (use "Decomissionar" on the site for those instead).
   */
  async removePrinterForAgent(agent: Agent, id: string) {
    const printer = await this.prisma.printer.findFirst({ where: { id, agentId: agent.id } });
    if (!printer) {
      throw new NotFoundException('Impressora não encontrada');
    }
    if (printer.status !== 'DISCOVERED' && printer.status !== 'IGNORED') {
      throw new BadRequestException(
        'Só é possível remover impressoras ainda não monitoradas (pendentes ou desativadas). Para retirar uma impressora monitorada, use "Decomissionar" no site.',
      );
    }
    try {
      await this.prisma.printer.delete({ where: { id } });
    } catch (error) {
      // FK constraint (P2003) — some record (uma OS, contrato, alerta...)
      // still references this printer despite it never having been
      // formally claimed. Surface that plainly instead of a raw 500.
      if ((error as { code?: string }).code === 'P2003') {
        throw new BadRequestException(
          'Esta impressora ainda tem registros vinculados (ordem de serviço, contrato ou alerta) e não pode ser removida.',
        );
      }
      throw error;
    }
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
