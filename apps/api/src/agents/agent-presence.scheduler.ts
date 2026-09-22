import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AgentsService } from './agents.service';

/**
 * Periodically flips agents/printers that stopped reporting to OFFLINE.
 *
 * The heartbeat/ingestion path only ever sets ONLINE; nothing marks the
 * transition to OFFLINE on its own. AgentsService.markOfflineStale does the
 * flip, but until now nothing called it on a timer — so onlineStatus could
 * stay ONLINE forever after an agent died. This wires it to a configurable
 * interval so the "Comunicação" columns in the Impressoras submenus reflect
 * reality.
 *
 * The interval is registered dynamically (not via the @Interval decorator)
 * so it can be driven by config and disabled entirely with
 * AGENT_OFFLINE_CHECK_INTERVAL_SECONDS=0.
 */
@Injectable()
export class AgentPresenceScheduler implements OnModuleInit {
  private readonly logger = new Logger(AgentPresenceScheduler.name);
  private static readonly INTERVAL_NAME = 'agent-offline-sweep';
  private running = false;

  constructor(
    private readonly agents: AgentsService,
    private readonly config: ConfigService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const intervalSeconds = this.config.get<number>('AGENT_OFFLINE_CHECK_INTERVAL_SECONDS', 60);
    if (!intervalSeconds || intervalSeconds <= 0) {
      this.logger.log('Agent offline sweep disabled (AGENT_OFFLINE_CHECK_INTERVAL_SECONDS <= 0).');
      return;
    }

    const thresholdSeconds = this.config.get<number>('AGENT_OFFLINE_THRESHOLD_SECONDS', 120);
    const interval = setInterval(() => {
      void this.sweep(thresholdSeconds);
    }, intervalSeconds * 1000);
    this.registry.addInterval(AgentPresenceScheduler.INTERVAL_NAME, interval);
    this.logger.log(
      `Agent offline sweep scheduled every ${intervalSeconds}s (threshold ${thresholdSeconds}s).`,
    );
  }

  /** Guarded so a slow DB pass can't overlap with the next tick. */
  private async sweep(thresholdSeconds: number) {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.agents.markOfflineStale(thresholdSeconds);
      if (result.agentsMarkedOffline > 0 || result.printersMarkedOffline > 0) {
        this.logger.log(
          `Offline sweep: ${result.agentsMarkedOffline} agent(s), ${result.printersMarkedOffline} printer(s) marcados como OFFLINE.`,
        );
      }
    } catch (err) {
      this.logger.error('Falha no sweep de offline de agents/impressoras', err instanceof Error ? err.stack : String(err));
    } finally {
      this.running = false;
    }
  }
}
