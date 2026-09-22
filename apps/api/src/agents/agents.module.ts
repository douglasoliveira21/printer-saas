import { Module } from '@nestjs/common';
import { AgentsController, AgentApiController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentAuthGuard } from './agent-auth.guard';
import { AgentPresenceScheduler } from './agent-presence.scheduler';
import { SnmpCredentialsModule } from '../snmp-credentials/snmp-credentials.module';

@Module({
  imports: [SnmpCredentialsModule],
  controllers: [AgentsController, AgentApiController],
  providers: [AgentsService, AgentAuthGuard, AgentPresenceScheduler],
  exports: [AgentsService],
})
export class AgentsModule {}
