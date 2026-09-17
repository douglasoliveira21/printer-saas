import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { EnrollAgentDto, HeartbeatDto, SubmitDevicesDto } from './dto/agent-payloads.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AgentAuthGuard } from './agent-auth.guard';
import { CurrentAgent } from './current-agent.decorator';
import type { Agent } from '@prisma/client';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @RequirePermissions('agents.create')
  createEnrollment(@Body() dto: CreateAgentDto) {
    return this.agentsService.createEnrollment(dto);
  }

  @Get()
  @RequirePermissions('agents.view')
  findAll() {
    return this.agentsService.findAll();
  }

  @Patch(':id')
  @RequirePermissions('agents.create')
  rename(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.agentsService.rename(id, dto.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('agents.create')
  remove(@Param('id') id: string) {
    return this.agentsService.remove(id);
  }

  @Post(':id/regenerate-token')
  @RequirePermissions('agents.create')
  regenerateToken(@Param('id') id: string) {
    return this.agentsService.regenerateToken(id);
  }
}

/**
 * Endpoints called by the Windows Agent itself. Versioned separately from
 * the human-facing API and authenticated with an Agent API key rather than
 * a user JWT (see AgentAuthGuard) — `enroll` is the one exception, which is
 * bootstrapped from the one-time installation token instead.
 */
@ApiTags('agent-api')
@Controller('agent-api/v1')
export class AgentApiController {
  constructor(private readonly agentsService: AgentsService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('enroll')
  enroll(@Body() dto: EnrollAgentDto) {
    return this.agentsService.enroll(dto);
  }

  @Public()
  @UseGuards(AgentAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('heartbeat')
  heartbeat(@CurrentAgent() agent: Agent, @Body() dto: HeartbeatDto) {
    return this.agentsService.heartbeat(agent, dto);
  }

  @Public()
  @UseGuards(AgentAuthGuard)
  @Get('config')
  getConfig(@CurrentAgent() agent: Agent) {
    return this.agentsService.getConfig(agent);
  }

  @Public()
  @UseGuards(AgentAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('devices')
  submitDevices(@CurrentAgent() agent: Agent, @Body() dto: SubmitDevicesDto) {
    return this.agentsService.submitDevices(agent, dto);
  }
}
