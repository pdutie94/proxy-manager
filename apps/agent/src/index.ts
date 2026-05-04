import Redis from 'ioredis';
import axios from 'axios';
import { EventConsumer } from './events/consumer';
import { HealthServer } from './health/server';
import { BandwidthCollector } from './events/bandwidth-collector';
import { MetricsCollector } from './events/metrics-collector';
import { MockRedis } from './redis/mock-redis';

const NODE_ID = parseInt(process.env.NODE_ID || '1');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  console.log(`Starting Proxy Agent for Node ${NODE_ID}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);

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

  console.log('Agent ready');
}

main().catch(console.error);
