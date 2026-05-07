import Redis from 'ioredis';
import axios from 'axios';
import { EventConsumer } from './events/consumer';
import { HealthServer } from './health/server';
import { BandwidthCollector } from './events/bandwidth-collector';
import { MetricsCollector } from './events/metrics-collector';
import { MockRedis } from './redis/mock-redis';
import { logger } from './logger';

const NODE_ID = parseInt(process.env.NODE_ID || '1');
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  logger.info(`Starting Proxy Agent for Node ${NODE_ID}`);
  logger.info(`DRY_RUN: ${DRY_RUN}`);

  const redis = (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL)
    ? new MockRedis() as any
    : new Redis(REDIS_URL);

  const api = axios.create({ baseURL: API_URL });

  const status = {
    lastEventTime: null as string | null,
    activeProxies: 0,
  };

  const metrics = new MetricsCollector();

  const healthServer = new HealthServer(redis, async () => ({
    proxyStatus: {
      lastEventTime: status.lastEventTime,
      activeProxies: status.activeProxies,
    },
    metrics: metrics.getSnapshot(),
  }));
  await healthServer.start(3002);

  const consumer = new EventConsumer(redis, api, {
    nodeId: NODE_ID,
    dryRun: DRY_RUN,
    status,
    metrics,
  });

  const bandwidthCollector = new BandwidthCollector(api, metrics);
  await bandwidthCollector.start();

  await consumer.reconcile();
  await consumer.start();

  logger.info('Agent ready');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`\nReceived ${signal}. Starting graceful shutdown...`);
    await consumer.stop();
    await healthServer.stop();
    bandwidthCollector.stop();
    
    // Disconnect Redis
    if (redis && typeof redis.disconnect === 'function') {
      redis.disconnect();
    }
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(err => logger.error(err));
