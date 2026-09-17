import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Authenticates an Agent (not a human user) via a long-lived API key issued
 * at enrollment time. Header format: `Authorization: AgentKey <agentId>.<secret>`.
 * On success, attaches `request.agent` (raw DB row, already tenant-bound by
 * construction — an Agent only ever belongs to one tenant).
 */
@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];
    if (!header?.startsWith('AgentKey ')) {
      throw new UnauthorizedException('Missing agent credentials');
    }

    const raw = header.slice('AgentKey '.length).trim();
    const [agentId, secret] = raw.split('.');
    if (!agentId || !secret) {
      throw new UnauthorizedException('Malformed agent credentials');
    }

    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || !agent.apiKeyHash || agent.status === 'DISABLED') {
      throw new UnauthorizedException('Invalid agent credentials');
    }

    const valid = await argon2.verify(agent.apiKeyHash, secret);
    if (!valid) {
      throw new UnauthorizedException('Invalid agent credentials');
    }

    request.agent = agent;
    return true;
  }
}
