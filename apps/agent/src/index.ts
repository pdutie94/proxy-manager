import Redis from 'ioredis';
import axios from 'axios';
import { EventConsumer } from './events/consumer';
import { ConfigRenderer } from './config/renderer';
import { HealthServer } from './health/server';
import { CONFIG } from '@proxy-manager/common';
import { MockRedis } from './redis/mock-redis';

const NODE_ID = parseInt(process.env.NODE_ID || '1');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  console.log(`Starting Proxy Agent for Node ${NODE_ID}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);

  // Use Mock Redis for development
  const redis = (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) 
    ? new MockRedis() as any 
    : new Redis(REDIS_URL);
    
  const api = axios.create({ baseURL: API_URL });

  // Start health server
  const healthServer = new HealthServer(redis);
  await healthServer.start(3002);

  // Start event consumer
  const consumer = new EventConsumer(redis, api, {
    nodeId: NODE_ID,
    dryRun: DRY_RUN,
  });

  // Startup reconciliation
  await consumer.reconcile();

  // Start consuming events
  await consumer.start();

  console.log('Agent ready');
}

main().catch(console.error);
