import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AgentReleasesService } from './agent-releases.service';
import { CreateAgentReleaseDto } from './dto/create-agent-release.dto';
import { UpdateAgentReleaseDto } from './dto/update-agent-release.dto';
import { SuperAdminGuard } from '../super-admin.guard';

/** Publishing Agent releases (what auto-update pulls) is platform metadata, not tenant data — Super Admin only, same as the rest of /platform. The public agent-facing read (GET /agent-api/v1/latest-release) lives in AgentsController, not here. */
@ApiTags('platform')
@Controller('platform/agent-releases')
@UseGuards(SuperAdminGuard)
export class AgentReleasesController {
  constructor(private readonly service: AgentReleasesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAgentReleaseDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAgentReleaseDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
