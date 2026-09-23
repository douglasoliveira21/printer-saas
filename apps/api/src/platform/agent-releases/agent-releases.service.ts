import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAgentReleaseDto } from './dto/create-agent-release.dto';
import type { UpdateAgentReleaseDto } from './dto/update-agent-release.dto';

@Injectable()
export class AgentReleasesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.agentRelease.findMany({ orderBy: { publishedAt: 'desc' } });
  }

  async findOne(id: string) {
    const release = await this.prisma.agentRelease.findUnique({ where: { id } });
    if (!release) {
      throw new NotFoundException('Release não encontrada');
    }
    return release;
  }

  create(dto: CreateAgentReleaseDto) {
    return this.prisma.agentRelease.create({ data: dto });
  }

  async update(id: string, dto: UpdateAgentReleaseDto) {
    await this.findOne(id);
    return this.prisma.agentRelease.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.agentRelease.delete({ where: { id } });
  }

  /** What GET /agent-api/v1/latest-release actually serves — the most recently published active release, or null if none has been published yet (Agent just keeps running its current version). */
  findLatestActive() {
    return this.prisma.agentRelease.findFirst({ where: { isActive: true }, orderBy: { publishedAt: 'desc' } });
  }
}
