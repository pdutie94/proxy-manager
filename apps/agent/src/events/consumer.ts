import Redis from 'ioredis';
import { AxiosInstance } from 'axios';
import { logger } from '../logger';
import { createHmac } from 'crypto';
import { ProxyEvent, ProxyEventType, CONFIG, getShardIndex } from '@proxy-manager/common';
import { ConfigRenderer } from '../config/renderer';
import { MetricsCollector } from './metrics-collector';
import { EventPriorityQueue } from './priority-queue';

interface AgentStatus {
  lastEventTime: string | null;
  activeProxies: number;
}

export class EventConsumer {
  private redis: Redis;
  private api: AxiosInstance;
  private config: { nodeId: number; dryRun: boolean; status: AgentStatus; metrics: MetricsCollector };
  private renderer: ConfigRenderer;
  private consumerGroup = 'proxy-agent';
  private streamKey = 'proxy_events';
  private reconcileInterval?: NodeJS.Timeout;
  private priorityQueue = new EventPriorityQueue();
  private processingInterval?: NodeJS.Timeout;
  private reclaimInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(redis: Redis, api: AxiosInstance, config: { nodeId: number; dryRun: boolean; status: AgentStatus; metrics: MetricsCollector }) {
    this.redis = redis;
    this.api = api;
    this.config = config;
    this.renderer = new ConfigRenderer();
  }

  async start(): Promise<void> {
    logger.info('Starting event consumer...');
    
    try {
      await this.redis.xgroup('CREATE', this.streamKey, this.consumerGroup, '0', 'MKSTREAM');
      logger.info('Created consumer group');
    } catch (err: any) {
      if (!err.message.includes('BUSYGROUP')) {
        logger.error({ err }, 'Failed to create consumer group');
      }
    }

    this.startReclaimTask();
    this.startPeriodicReconcile();
    this.startPriorityQueueProcessor();
    this.startEventReader();

    logger.info('Event consumer initialized');
  }

  private startEventReader(): void {
    void (async () => {
      while (!this.isShuttingDown) {
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
              try {
                const rawJson = fields.length > 1 ? fields[1] : fields[0];
                const event = JSON.parse(rawJson) as ProxyEvent & { signature?: string };
                if (event.nodeId === this.config.nodeId) {
                  this.priorityQueue.add(id, fields, event);
                }
              } catch (err) {
                logger.error({ err }, 'Failed to parse event');
              }
            }
          }
        } catch (err) {
          logger.error({ err }, 'Event reader error');
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    })();
  }

  private startPriorityQueueProcessor(): void {
    this.processingInterval = setInterval(async () => {
      try {
        while (this.priorityQueue.size() > 0) {
          const item = this.priorityQueue.take();
          if (item) {
            await this.processMessage(item.id, item.fields);
          }
        }
      } catch (err) {
        logger.error({ err }, 'Priority queue processor error');
      }
    }, 100);
  }

  private startReclaimTask(): void {
    this.reclaimInterval = setInterval(async () => {
      try {
        await this.reclaimFailedEvents();
      } catch (err) {
        logger.error({ err }, 'Reclaim task error');
      }
    }, 30000); // Every 30 seconds
  }

  private startPeriodicReconcile(): void {
    this.reconcileInterval = setInterval(async () => {
      try {
        await this.reconcile();
      } catch (err) {
        logger.error({ err }, 'Periodic reconcile failed');
      }
    }, CONFIG.RECONCILE_INTERVAL_MINUTES * 60 * 1000);
  }

  async stop(): Promise<void> {
    logger.info('Shutting down event consumer...');
    this.isShuttingDown = true;
    
    if (this.reconcileInterval) clearInterval(this.reconcileInterval);
    if (this.processingInterval) clearInterval(this.processingInterval);
    if (this.reclaimInterval) clearInterval(this.reclaimInterval);

    // Drain queue
    while (this.priorityQueue.size() > 0) {
      const item = this.priorityQueue.take();
      if (item) {
        await this.processMessage(item.id, item.fields);
      }
    }
    logger.info('Event consumer stopped');
  }

  private async reclaimFailedEvents(): Promise<void> {
    logger.info('Checking for failed events to reclaim...');

    let pendingSummary: any;
    try {
      pendingSummary = await this.redis.xpending(this.streamKey, this.consumerGroup);
    } catch (err) {
      logger.error({ err }, 'Unable to fetch XPENDING summary');
      return;
    }

    const totalPending = Array.isArray(pendingSummary) && typeof pendingSummary[0] === 'number'
      ? pendingSummary[0]
      : Array.isArray(pendingSummary)
        ? pendingSummary.length
        : 0;

    if (totalPending === 0) {
      return;
    }

    const minIdleTime = 60000; // 1 minute

    const pendingEntries = await this.redis.xpending(
      this.streamKey,
      this.consumerGroup,
      '-',
      '+',
      100,
    );

    if (!pendingEntries || pendingEntries.length === 0) {
      return;
    }

    for (const entry of pendingEntries as any[]) {
      const [messageId, consumer, idleTime, deliveryCount] = entry;

      if (idleTime >= minIdleTime && deliveryCount < 3) {
        try {
          const claimed = await this.redis.xclaim(
            this.streamKey,
            this.consumerGroup,
            `agent-${this.config.nodeId}`,
            minIdleTime,
            messageId,
          );

          if (claimed && claimed.length > 0) {
            logger.info(`Reclaimed failed event ${messageId} from ${consumer}`);
            for (const [id, fields] of claimed as any[]) {
              await this.processMessage(id, fields);
            }
          }
        } catch (err) {
          logger.error({ err, messageId }, 'Failed to reclaim event');
        }
      } else if (deliveryCount >= 3) {
        logger.warn(`Event ${messageId} failed ${deliveryCount} times, marking as dead`);
        await this.redis.xack(this.streamKey, this.consumerGroup, messageId);
      }
    }
  }

  private async processMessage(id: string, fields: string[]): Promise<void> {
    try {
      const rawJson = fields.length > 1 ? fields[1] : fields[0];
      const event = JSON.parse(rawJson) as ProxyEvent & { signature?: string };

      // Filter by node
      if (event.nodeId !== this.config.nodeId) {
        await this.redis.xack(this.streamKey, this.consumerGroup, id);
        return;
      }

      if (!this.verifySignature(event)) {
        logger.warn(`Signature verification failed for proxy ${event.proxyId}`);
        await this.redis.xack(this.streamKey, this.consumerGroup, id);
        return;
      }

      logger.info(`Processing ${event.type} for proxy ${event.proxyId}`);

      if (this.config.dryRun) {
        logger.info('DRY_RUN: Would process event');
        await this.redis.xack(this.streamKey, this.consumerGroup, id);
        return;
      }

      let current: any = null;
      try {
        const response = await this.api.get(`/api/proxies/${event.proxyId}`);
        current = response.data;
      } catch (error: any) {
        if (error.response?.status === 404) {
          logger.info(`Proxy ${event.proxyId} not found, will create`);
        } else {
          throw error;
        }
      }

      if (current && current.lastConfigHash === event.configHash && event.type !== ProxyEventType.PROXY_DELETE) {
        logger.info(`Event already applied to proxy ${event.proxyId}, skipping`);
        await this.redis.xack(this.streamKey, this.consumerGroup, id);
        this.config.status.lastEventTime = new Date().toISOString();
        return;
      }

      if (current && event.version < current.version && event.type !== ProxyEventType.PROXY_DELETE) {
        logger.info(`Out of order event for proxy ${event.proxyId}, skipping (event: ${event.version} < current: ${current.version})`);
        await this.redis.xack(this.streamKey, this.consumerGroup, id);
        this.config.status.lastEventTime = new Date().toISOString();
        return;
      }

      switch (event.type) {
        case ProxyEventType.PROXY_CREATE:
        case ProxyEventType.PROXY_RENEW:
          await this.renderer.addProxy(event);
          break;
        case ProxyEventType.PROXY_DELETE:
        case ProxyEventType.PROXY_EXPIRE:
          await this.renderer.removeProxy(Number(event.proxyId), event.port!);
          break;
        case ProxyEventType.NODE_SUSPEND:
          await this.renderer.removeAllProxies();
          break;
        case ProxyEventType.NODE_RESUME:
          await this.reconcile();
          break;
      }

      const isProxyEvent = [
        ProxyEventType.PROXY_CREATE,
        ProxyEventType.PROXY_RENEW,
        ProxyEventType.PROXY_DELETE,
        ProxyEventType.PROXY_EXPIRE
      ].includes(event.type);

      if (isProxyEvent) {
        await this.api.post(`/api/proxies/${event.proxyId.toString()}/applied`, {
          configHash: event.configHash,
        });
      }

      await this.redis.xack(this.streamKey, this.consumerGroup, id);

      this.config.status.lastEventTime = new Date().toISOString();
      this.config.status.activeProxies = this.renderer.getProxyCount();
      this.config.metrics.recordConfigUpdate();

      logger.info(`Processed ${event.type} for proxy ${event.proxyId}`);
    } catch (err) {
      logger.error({ err }, 'Failed to process message');
      this.config.metrics.recordError();
    }
  }

  async reconcile(): Promise<void> {
    logger.info('Starting reconciliation...');
    
    // Fetch all active proxies from API
    const response = await this.api.get('/api/proxies', {
      params: { nodeId: this.config.nodeId, status: 'active' },
    });

    const proxies = response.data;
    logger.info(`Found ${proxies.length} active proxies`);

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

    logger.info('Reconciliation complete');
  }

  private verifySignature(event: ProxyEvent): boolean {
    const secret = process.env.HMAC_SECRET;
    if (!secret) {
      return true;
    }

    if (!event.signature) {
      return false;
    }

    const payloadCopy = { ...event } as any;
    delete payloadCopy.signature;
    const data = JSON.stringify(payloadCopy);
    const signature = createHmac('sha256', secret).update(data).digest('hex');
    return signature === event.signature;
  }
}
