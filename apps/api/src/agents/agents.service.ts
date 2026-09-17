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
          lastSeenAt: new Date(),
          lastCollectedAt: new Date(),
        },
        update: {
          // IP may have changed (§69) — identity is the fingerprint, not the IP.
          ip: device.ip,
          mac: device.mac ?? undefined,
          hostname: device.hostname ?? undefined,
          firmware: device.firmware ?? undefined,
          sysDescr: device.sysDescr ?? undefined,
          onlineStatus: 'ONLINE',
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
        await this.prisma.consumableReading.createMany({
          data: device.consumables.map((c) => ({
            printerId: printer.id,
            type: c.type,
            color: c.color,
            levelPercent: c.levelPercent ? Math.round(c.levelPercent) : undefined,
            capacity: c.capacity,
            name: c.name,
            serial: c.serial,
          })),
        });
      }

      results.push({ fingerprint, printerId: printer.id, status: printer.status });
    }
    return { processed: results.length, results };
  }

  private computeFingerprint(agentId: string, device: { serial?: string; mac?: string; ip?: string }): string | null {
    // Priority: serial (most stable) > MAC > agent+IP (weakest, changes on DHCP renewal).
    if (device.serial) return `serial:${device.serial}`;
    if (device.mac) return `mac:${device.mac}`;
    if (device.ip) return `agent-ip:${agentId}:${device.ip}`;
    return null;
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
