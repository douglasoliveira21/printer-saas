import { Module } from '@nestjs/common';
import { AgentsController, AgentApiController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentAuthGuard } from './agent-auth.guard';

@Module({
  controllers: [AgentsController, AgentApiController],
  providers: [AgentsService, AgentAuthGuard],
  exports: [AgentsService],
})
export class AgentsModule {}
