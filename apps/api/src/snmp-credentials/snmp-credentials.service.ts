import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { SecretCryptoService } from '../common/crypto/secret-crypto.service';
import type { CreateSnmpCredentialDto } from './dto/create-snmp-credential.dto';
import type { UpdateSnmpCredentialDto } from './dto/update-snmp-credential.dto';

/**
 * CRUD for tenant-owned SNMP v3 credential sets (spec: per-printer SNMP v3,
 * not just one community string per Agent). Passwords are encrypted at rest
 * via SecretCryptoService and never returned in plaintext from this
 * service — only `AgentsService.getConfig` decrypts them, to hand to the
 * Agent that actually needs to authenticate with them.
 */
@Injectable()
export class SnmpCredentialsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly crypto: SecretCryptoService,
  ) {}

  async findAll() {
    const credentials = await this.tenantPrisma.client.snmpV3Credential.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { printers: true, defaultForAgents: true } },
      },
    });
    return credentials.map((c) => this.toSummary(c));
  }

  async findOne(id: string) {
    const credential = await this.tenantPrisma.client.snmpV3Credential.findFirst({
      where: { id },
      include: { _count: { select: { printers: true, defaultForAgents: true } } },
    });
    if (!credential) {
      throw new NotFoundException('Credencial SNMP v3 não encontrada');
    }
    return this.toSummary(credential);
  }

  async create(dto: CreateSnmpCredentialDto) {
    const credential = await this.tenantPrisma.client.snmpV3Credential.create({
      // tenantId is injected at runtime by the tenant-scoped Prisma extension.
      data: this.toWriteData(dto) as any,
    });
    return this.toSummary({ ...credential, _count: { printers: 0, defaultForAgents: 0 } });
  }

  async update(id: string, dto: UpdateSnmpCredentialDto) {
    await this.findOne(id);
    const credential = await this.tenantPrisma.client.snmpV3Credential.update({
      where: { id },
      data: this.toWriteData(dto),
    });
    return this.findOne(credential.id);
  }

  async remove(id: string) {
    const credential = await this.findOne(id);
    if (credential.printersUsingIt > 0 || credential.agentsUsingItAsDefault > 0) {
      throw new BadRequestException(
        'Esta credencial ainda está em uso por impressoras ou como padrão de algum Agent — reatribua-as antes de remover.',
      );
    }
    await this.tenantPrisma.client.snmpV3Credential.delete({ where: { id } });
    return { removed: true };
  }

  /** Encrypts whichever password fields are present; a field left out of the DTO (update) is simply omitted from the write, never blanked. */
  private toWriteData(dto: Partial<CreateSnmpCredentialDto>) {
    const data: Record<string, unknown> = {
      name: dto.name,
      userName: dto.userName,
      securityLevel: dto.securityLevel,
      authenticationProtocol: dto.securityLevel === 'noAuthNoPriv' ? null : dto.authenticationProtocol,
      privacyProtocol: dto.securityLevel === 'authPriv' ? dto.privacyProtocol : null,
      contextName: dto.contextName ?? null,
    };
    if (dto.authenticationPassword) {
      data.authenticationPasswordEncrypted = this.crypto.encrypt(dto.authenticationPassword);
    } else if (dto.securityLevel === 'noAuthNoPriv') {
      data.authenticationPasswordEncrypted = null;
    }
    if (dto.privacyPassword) {
      data.privacyPasswordEncrypted = this.crypto.encrypt(dto.privacyPassword);
    } else if (dto.securityLevel && dto.securityLevel !== 'authPriv') {
      data.privacyPasswordEncrypted = null;
    }
    // Remove undefined keys so a partial update doesn't overwrite unset fields with undefined (Prisma would otherwise error on it, but being explicit here keeps intent clear).
    return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  }

  /** Never exposes the encrypted password blobs, let alone plaintext — only whether each is set, so the UI can show "senha configurada" without round-tripping the secret. */
  private toSummary(credential: {
    id: string;
    name: string;
    userName: string;
    securityLevel: string;
    authenticationProtocol: string | null;
    authenticationPasswordEncrypted: string | null;
    privacyProtocol: string | null;
    privacyPasswordEncrypted: string | null;
    contextName: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { printers: number; defaultForAgents: number };
  }) {
    return {
      id: credential.id,
      name: credential.name,
      userName: credential.userName,
      securityLevel: credential.securityLevel,
      authenticationProtocol: credential.authenticationProtocol,
      hasAuthenticationPassword: !!credential.authenticationPasswordEncrypted,
      privacyProtocol: credential.privacyProtocol,
      hasPrivacyPassword: !!credential.privacyPasswordEncrypted,
      contextName: credential.contextName,
      printersUsingIt: credential._count.printers,
      agentsUsingItAsDefault: credential._count.defaultForAgents,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }
}
