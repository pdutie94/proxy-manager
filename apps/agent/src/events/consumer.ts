import Redis from 'ioredis';
import { AxiosInstance } from 'axios';
import { ProxyEvent, ProxyEventType, CONFIG, getShardIndex } from '@proxy-manager/common';
import { ConfigRenderer } from '../config/renderer';

export class EventConsumer {
  private redis: Redis;
  private api: AxiosInstance;
  private config: { nodeId: number; dryRun: boolean };
  private renderer: ConfigRenderer;
  private consumerGroup = 'proxy-agent';
  private streamKey = 'proxy_events';
  private lastId = '0';

  constructor(redis: Redis, api: AxiosInstance, config: { nodeId: number; dryRun: boolean }) {
    this.redis = redis;
    this.api = api;
    this.config = config;
    this.renderer = new ConfigRenderer();
  }

  async start(): Promise<void> {
    console.log('Starting event consumer...');
    
    // Create consumer group if not exists
    try {
      await this.redis.xgroup('CREATE', this.streamKey, this.consumerGroup, '0', 'MKSTREAM');
      console.log('Created consumer group');
    } catch (err: any) {
      if (!err.message.includes('BUSYGROUP')) {
        console.error('Failed to create consumer group:', err);
      }
    }

    // Start reclaim task for failed events
    this.startReclaimTask();

    while (true) {
      try {
        const messages = await this.redis.xreadgroup(
          'GROUP',
          this.consumerGroup,
          `agent-${this.config.nodeId}`,
          'COUNT',
          10,
          'BLOCK',
          5000,
          'STREAMS',
          this.streamKey,
          '>',
        );

        if (!messages) continue;

        for (const [, streamMessages] of messages as any[]) {
          for (const [id, fields] of streamMessages) {
            await this.processMessage(id, fields);
          }
        }
      } catch (err) {
        console.error('Consumer error:', err);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  private startReclaimTask(): void {
    setInterval(async () => {
      try {
        await this.reclaimFailedEvents();
      } catch (err) {
        console.error('Reclaim task error:', err);
      }
    }, 30000); // Every 30 seconds
  }

  private async reclaimFailedEvents(): Promise<void> {
    console.log('Checking for failed events to reclaim...');
    
    const pending = await this.redis.xpending(this.streamKey, this.consumerGroup);
    if (!pending || pending.length === 0) {
      return;
    }

    const minIdleTime = 60000; // 1 minute
    const now = Date.now();
    
    for (const entry of pending as any[]) {
      const [messageId, consumer, idleTime, deliveryCount] = entry;
      
      // Reclaim if idle for more than 1 minute and delivered less than 3 times
      if (idleTime >= minIdleTime && deliveryCount < 3) {
        try {
          const claimed = await this.redis.xclaim(
            this.streamKey,
            this.consumerGroup,
            `agent-${this.config.nodeId}`,
            minIdleTime,
            messageId
          );
          
          if (claimed && claimed.length > 0) {
            console.log(`Reclaimed failed event ${messageId} from ${consumer}`);
            for (const [id, fields] of claimed as any[]) {
              await this.processMessage(id, fields);
            }
          }
        } catch (err) {
          console.error(`Failed to reclaim event ${messageId}:`, err);
        }
      } else if (deliveryCount >= 3) {
        // Move to dead letter after 3 failed attempts
        console.warn(`Event ${messageId} failed ${deliveryCount} times, marking as dead`);
        await this.redis.xack(this.streamKey, this.consumerGroup, messageId);
      }
    }
  }

  private async processMessage(id: string, fields: string[]): Promise<void> {
    try {
      const data = JSON.parse(fields[1]);
      const event = data as ProxyEvent;

      // Filter by node
      if (event.nodeId !== this.config.nodeId) {
        await this.redis.xack(this.streamKey, this.consumerGroup, id);
        return;
      }

      console.log(`Processing ${event.type} for proxy ${event.proxyId}`);

      if (this.config.dryRun) {
        console.log('DRY_RUN: Would process event');
        await this.redis.xack(this.streamKey, this.consumerGroup, id);
        return;
      }

      // Check idempotency
      let current: any = null;
      try {
        const response = await this.api.get(`/api/proxies/${event.proxyId}`);
        current = response.data;
      } catch (error: any) {
        if (error.response?.status === 404) {
          // Proxy doesn't exist - this is expected for CREATE events
          console.log(`Proxy ${event.proxyId} not found, will create`);
        } else {
          throw error; // Re-throw other errors
        }
      }

      // Idempotency check: if proxy exists and config hash matches, skip
      if (current && current.lastConfigHash === event.configHash && event.type !== ProxyEventType.PROXY_DELETE) {
        console.log(`Event already applied to proxy ${event.proxyId}, skipping`);
        await this.redis.xack(this.streamKey, this.consumerGroup, id);
        return;
      }

      // Version ordering check: only if proxy exists
      if (current && event.version < current.version && event.type !== ProxyEventType.PROXY_DELETE) {
        console.log(`Out of order event for proxy ${event.proxyId}, skipping (event: ${event.version} < current: ${current.version})`);
        await this.redis.xack(this.streamKey, this.consumerGroup, id);
        return;
      }

      // Process based on type
      switch (event.type) {
        case ProxyEventType.PROXY_CREATE:
        case ProxyEventType.PROXY_RENEW:
          await this.renderer.addProxy(event);
          break;
        case ProxyEventType.PROXY_DELETE:
        case ProxyEventType.PROXY_EXPIRE:
          await this.renderer.removeProxy(Number(event.proxyId), event.port!);
          break;
      }

      // ACK event
      await this.redis.xack(this.streamKey, this.consumerGroup, id);

      // Notify API that config was applied
      await this.api.post(`/api/proxies/${event.proxyId.toString()}/applied`, {
        configHash: event.configHash,
      });

      console.log(`Processed ${event.type} for proxy ${event.proxyId}`);
    } catch (err) {
      console.error('Failed to process message:', err);
      // Don't ACK - will be reclaimed
    }
  }

  async reconcile(): Promise<void> {
    console.log('Starting reconciliation...');
    
    // Fetch all active proxies from API
    const response = await this.api.get('/api/proxies', {
      params: { nodeId: this.config.nodeId, status: 'active' },
    });

    const proxies = response.data;
    console.log(`Found ${proxies.length} active proxies`);

    // Group by shard
    const shards = new Map<string, typeof proxies>();
    for (const proxy of proxies) {
      const shard = getShardIndex(proxy.port.port);
      if (!shards.has(shard)) shards.set(shard, []);
      shards.get(shard)!.push(proxy);
    }

    // Rebuild each shard
    for (const [shard, shardProxies] of shards) {
      await this.renderer.rebuildShard(shard, shardProxies);
    }

    console.log('Reconciliation complete');
  }
}
