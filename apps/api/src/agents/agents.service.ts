import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { Prisma, type Agent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { CreateAgentDto } from './dto/create-agent.dto';
import type { UpdateAgentDto } from './dto/update-agent.dto';
import type { EnrollAgentDto, HeartbeatDto, SubmitDevicesDto } from './dto/agent-payloads.dto';
import { SecretCryptoService } from '../common/crypto/secret-crypto.service';
import { AgentReleasesService } from '../platform/agent-releases/agent-releases.service';

// Either the raw PrismaService or a Prisma.$transaction callback's `tx` —
// submitDevices runs its whole body against whichever one it's given, so
// the idempotency guard (a row insert) and the actual device processing
// commit or roll back together (Fase 2 — see submitDevices below).
type Db = Pick<
  Prisma.TransactionClient,
  'printer' | 'counterReading' | 'consumableReading' | 'printerAlertReading' | 'consumableReplacement' | 'printerCatalogModel'
>;

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
    private readonly secretCrypto: SecretCryptoService,
    private readonly agentReleases: AgentReleasesService,
  ) {}

  getLatestRelease() {
    return this.agentReleases.findLatestActive();
  }

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

  async update(id: string, dto: UpdateAgentDto) {
    await this.assertExists(id);
    // Same reasoning as PrintersService.update: the tenant-scoped extension
    // protects the Agent row being written, not a foreign key supplied in
    // the body, so a cross-tenant credential ID needs an explicit check.
    if (dto.defaultSnmpV3CredentialId) {
      const credential = await this.tenantPrisma.client.snmpV3Credential.findFirst({ where: { id: dto.defaultSnmpV3CredentialId } });
      if (!credential) {
        throw new NotFoundException('Credencial SNMP v3 não encontrada');
      }
    }
    return this.tenantPrisma.client.agent.update({
      where: { id },
      data: { name: dto.name, defaultSnmpV3CredentialId: dto.defaultSnmpV3CredentialId },
    });
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

  /**
   * Public, read-only: lets the ConfigTool show "é este o cliente mesmo?"
   * before actually installing — same validity check as enroll() but never
   * consumes the token (no update, no apiKeyHash issued). Used by the
   * Windows Agent's installer screen right after the person types/loads a
   * token, before the "Instalar e Iniciar" click really does anything.
   */
  async lookupEnrollmentToken(token: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { enrollmentToken: token },
      include: { customer: { select: { legalName: true, tradeName: true } } },
    });
    if (!agent || !agent.enrollmentTokenExpiresAt || agent.enrollmentTokenExpiresAt < new Date()) {
      throw new UnauthorizedException('Token de instalação inválido ou expirado');
    }
    return {
      agentName: agent.name,
      customerName: agent.customer?.tradeName || agent.customer?.legalName || null,
    };
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
    return {
      discoveryConfig: agent.discoveryConfig ?? null,
      snmpV3: await this.resolveSnmpV3ConfigForAgent(agent),
    };
  }

  /**
   * Resolves every SNMP v3 credential this Agent needs to authenticate with,
   * decrypted for transport over HTTPS to the Agent that actually has to use
   * them — this is the one place credentials are ever decrypted server-side.
   * `default` backs any printer under this Agent with no override.
   * `perIp` is keyed by the printer's last-known IP (not its database id) —
   * the Agent's SNMP prober only ever has an IP at probe time, never a
   * Printer id, since that mapping is resolved server-side by submitDevices
   * after the fact. Same known limitation as the rest of this system's
   * IP-based device tracking: if a printer's IP changes via DHCP, its
   * credential override won't apply at the new IP until the printer is
   * re-discovered there and this config is re-fetched.
   */
  private async resolveSnmpV3ConfigForAgent(agent: Agent) {
    const [defaultCredential, printersWithOverride] = await Promise.all([
      agent.defaultSnmpV3CredentialId
        ? this.prisma.snmpV3Credential.findUnique({ where: { id: agent.defaultSnmpV3CredentialId } })
        : null,
      this.prisma.printer.findMany({
        where: { agentId: agent.id, snmpV3CredentialId: { not: null }, ip: { not: null } },
        select: { ip: true, snmpV3Credential: true },
      }),
    ]);

    const toTransport = (c: NonNullable<typeof defaultCredential>) => ({
      userName: c.userName,
      securityLevel: c.securityLevel,
      authenticationProtocol: c.authenticationProtocol,
      authenticationPassword: c.authenticationPasswordEncrypted ? this.secretCrypto.decrypt(c.authenticationPasswordEncrypted) : null,
      privacyProtocol: c.privacyProtocol,
      privacyPassword: c.privacyPasswordEncrypted ? this.secretCrypto.decrypt(c.privacyPasswordEncrypted) : null,
      contextName: c.contextName,
    });

    const perIp: Record<string, ReturnType<typeof toTransport>> = {};
    for (const p of printersWithOverride) {
      if (p.ip && p.snmpV3Credential) {
        perIp[p.ip] = toTransport(p.snmpV3Credential);
      }
    }

    return {
      default: defaultCredential ? toTransport(defaultCredential) : null,
      perIp,
    };
  }

  /**
   * Normalized device payload from the Agent. Creates a `DISCOVERED` printer
   * on first sighting (never auto-claims it for a customer/contract — see
   * spec §23) or, for a known printer, appends counter/consumable history
   * and resolves IP churn via fingerprint dedup (see §68-69).
   */
  /**
   * Fase 2 (idempotência): when the Agent sends a collectionId, the whole
   * batch is processed inside a transaction guarded by a unique-constraint
   * insert into AgentSubmission. A batch reaching here a second time with
   * the same collectionId — the exact "API committed, but the HTTP response
   * got lost, so the Agent thought it failed and requeued the same batch"
   * scenario the OfflineQueue's retry exists for — hits the unique
   * violation and is recognized as already-processed instead of creating a
   * second CounterReading/ConsumableReading/PrinterAlertReading for the
   * same reading. Two concurrent requests with the same collectionId race
   * on the same unique constraint — only one wins, the other is treated as
   * a duplicate, never as an error surfaced to the Agent (both attempts
   * still return success). Older Agents that don't send a collectionId
   * (pre-Fase-2) skip the guard entirely and behave exactly as before —
   * no idempotency, same as today.
   */
  async submitDevices(agent: Agent, dto: SubmitDevicesDto) {
    if (!dto.collectionId) {
      return this.processDevices(agent, dto.devices, this.prisma);
    }

    return this.prisma.$transaction(async (tx) => {
      try {
        await tx.agentSubmission.create({
          data: { agentId: agent.id, collectionId: dto.collectionId!, deviceCount: dto.devices.length },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return { processed: 0, results: [], deduplicated: true };
        }
        throw err;
      }
      return this.processDevices(agent, dto.devices, tx);
    });
  }

  private async processDevices(agent: Agent, devices: SubmitDevicesDto['devices'], db: Db) {
    const results = [];
    for (const device of devices) {
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

      const printer = await db.printer.upsert({
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

      if (device.manufacturer || device.model) {
        await this.applyCatalogMatch(db, printer.id, device.manufacturer, device.model);
      }

      if (device.counters) {
        const { status, previousTotal } = await this.classifyCounterReading(db, printer.id, device.counters.total);
        await db.counterReading.create({
          data: {
            printerId: printer.id,
            total: device.counters.total,
            blackWhite: device.counters.blackWhite,
            color: device.counters.color,
            copies: device.counters.copies,
            printPages: device.counters.printPages,
            duplexPages: device.counters.duplexPages,
            raw: device.counters.raw as any,
            status,
            previousTotal,
          },
        });
      }

      if (device.consumables?.length) {
        for (const c of device.consumables) {
          const levelPercent = c.levelPercent !== undefined ? Math.round(c.levelPercent) : undefined;
          if (levelPercent !== undefined) {
            await this.detectReplacement(db, agent.tenantId, printer.id, c.type, c.color ?? null, levelPercent);
          }
          await db.consumableReading.create({
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

      if (device.alerts?.length) {
        await db.printerAlertReading.createMany({
          data: device.alerts.map((a) => ({
            printerId: printer.id,
            code: a.code,
            description: a.description,
            severity: a.severity,
          })),
        });
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
  /**
   * Fase 3 (proteção contra regressão de contadores) — compara o "total"
   * novo contra a leitura mais recente já gravada para este printer. Uma
   * queda (novo < anterior) NÃO é descartada nem zerada (spec: nunca
   * transformar ausência/anomalia em 0) — o valor bruto é sempre gravado,
   * só marcado como REGRESSED para auditoria; a causa real (reset de
   * fábrica, troca de equipamento/controladora, fingerprint incorreto, erro
   * de leitura pontual) não é determinável aqui, e não deve ser assumida.
   * Compara só contra a leitura imediatamente anterior (não a "correta
   * conhecida" mais antiga) — o mesmo padrão já usado em detectReplacement.
   */
  private async classifyCounterReading(
    db: Db,
    printerId: string,
    newTotal: number | undefined,
  ): Promise<{ status: 'NORMAL' | 'REGRESSED'; previousTotal: number | undefined }> {
    if (newTotal === undefined || newTotal === null) {
      return { status: 'NORMAL', previousTotal: undefined };
    }
    const previous = await db.counterReading.findFirst({
      where: { printerId, total: { not: null } },
      orderBy: { collectedAt: 'desc' },
      select: { total: true },
    });
    if (previous?.total === null || previous?.total === undefined) {
      return { status: 'NORMAL', previousTotal: undefined };
    }
    if (newTotal < previous.total) {
      return { status: 'REGRESSED', previousTotal: previous.total };
    }
    return { status: 'NORMAL', previousTotal: undefined };
  }

  /**
   * Fase 4 (debounce): a jump this big is raised as CANDIDATE first, never
   * CONFIRMED/PREMATURE on the spot — a single noisy SNMP reading, or
   * someone resetting a toner-low warning on the printer's own panel
   * without actually swapping the cartridge, can produce exactly this kind
   * of one-off spike. Confirmation only happens once the NEXT reading shows
   * the elevated level actually held — CANDIDATE rows are excluded from the
   * customer-facing timeline (see PrintersService.timeline) precisely so a
   * false alarm never gets shown as a real event before it's confirmed.
   */
  private async detectReplacement(db: Db, tenantId: string, printerId: string, type: string, color: string | null, newLevel: number) {
    const previous = await db.consumableReading.findFirst({
      where: { printerId, type, color },
      orderBy: { collectedAt: 'desc' },
      select: { levelPercent: true },
    });
    if (previous?.levelPercent === null || previous?.levelPercent === undefined) return;

    // A candidate already raised from the PREVIOUS reading — this call
    // decides whether it persisted (confirm) or was a one-off (dismiss),
    // and never raises a second candidate from the same reading.
    const candidate = await db.consumableReplacement.findFirst({ where: { printerId, type, color, status: 'CANDIDATE' } });
    if (candidate) {
      const baseline = candidate.levelPercentAtReplacement;
      const persisted = baseline !== null && newLevel - baseline >= REPLACEMENT_JUMP_THRESHOLD;
      if (persisted) {
        const status = baseline! > PREMATURE_REPLACEMENT_LEVEL ? 'PREMATURE' : 'CONFIRMED';
        await db.consumableReplacement.update({ where: { id: candidate.id }, data: { status, replacedAt: new Date() } });
      } else {
        // Didn't hold — was noise, not a real swap. If this candidate came
        // from an upgraded PREDICTED row (had a forecast date), revert it
        // back to PREDICTED instead of discarding the forecast entirely.
        await db.consumableReplacement.update({
          where: { id: candidate.id },
          data: { status: candidate.predictedAt !== null ? 'PREDICTED' : 'DISMISSED', levelPercentAtReplacement: null },
        });
      }
      return;
    }

    if (newLevel - previous.levelPercent < REPLACEMENT_JUMP_THRESHOLD) return;

    const existingPredicted = await db.consumableReplacement.findFirst({ where: { printerId, type, color, status: 'PREDICTED' } });
    if (existingPredicted) {
      await db.consumableReplacement.update({
        where: { id: existingPredicted.id },
        data: { status: 'CANDIDATE', levelPercentAtReplacement: previous.levelPercent },
      });
    } else {
      await db.consumableReplacement.create({
        data: { tenantId, printerId, type, color, levelPercentAtReplacement: previous.levelPercent, status: 'CANDIDATE' },
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

  private static readonly CAPABILITY_KEYS = ['color', 'duplex', 'a3', 'copy', 'scan', 'fax'] as const;

  /**
   * Matches the discovered manufacturer/model against the researched global
   * catalog (see docs/printer-catalog/) — "homologada" just means this FK is
   * set. Only fills capability fields the live probe left null; a value
   * already confirmed live (true or false) is never overwritten by the
   * catalog, same priority rule already used for A3 elsewhere in this file.
   */
  private async applyCatalogMatch(db: Db, printerId: string, manufacturer: string | undefined, model: string | undefined) {
    if (!model && !manufacturer) return;

    const candidates = await db.printerCatalogModel.findMany({
      where: manufacturer ? { manufacturer: { equals: manufacturer, mode: 'insensitive' } } : undefined,
    });
    const modelLower = model?.toLowerCase();
    const match = candidates.find((c) => {
      if (!modelLower) return false;
      if (c.model.toLowerCase() === modelLower) return true;
      if (modelLower.includes(c.model.toLowerCase()) || c.model.toLowerCase().includes(modelLower)) return true;
      return c.aliases.some((a) => a.toLowerCase() === modelLower);
    });
    if (!match) return;

    const printer = await db.printer.findUnique({ where: { id: printerId } });
    if (!printer) return;

    const currentCaps = (printer.capabilities as Record<string, boolean | null>) ?? {};
    const currentSources = (printer.capabilitySources as Record<string, string>) ?? {};
    const catalogCaps = (match.capabilities as Record<string, boolean | null>) ?? {};

    const mergedCaps = { ...currentCaps };
    const mergedSources = { ...currentSources };
    for (const key of AgentsService.CAPABILITY_KEYS) {
      if ((mergedCaps[key] === undefined || mergedCaps[key] === null) && catalogCaps[key] !== undefined && catalogCaps[key] !== null) {
        mergedCaps[key] = catalogCaps[key];
        mergedSources[key] = 'catalog';
      }
    }

    await db.printer.update({
      where: { id: printerId },
      data: {
        catalogModelId: match.id,
        capabilities: mergedCaps as any,
        capabilitySources: mergedSources as any,
        // Legacy standalone field mirrors capabilities.a3 — same rule as everywhere else this field is touched.
        supportsA3: printer.supportsA3 ?? (mergedCaps.a3 ?? undefined),
      },
    });
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
