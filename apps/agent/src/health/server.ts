import express from 'express';
import Redis from 'ioredis';
import { logger } from '../logger';

type StatusProvider = () => Promise<Record<string, unknown>>;

export class HealthServer {
  private app: express.Application;
  private redis: Redis;
  private startTime = Date.now();
  private statusProvider?: StatusProvider;

  constructor(redis: Redis, statusProvider?: StatusProvider) {
    this.app = express();
    this.redis = redis;
    this.statusProvider = statusProvider;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.get('/health', async (req, res) => {
      try {
        await this.redis.ping();

        let queueLength = 0;
        try {
          const pending = await this.redis.xpending('proxy_events', 'proxy-agent');
          if (Array.isArray(pending) && typeof pending[0] === 'number') {
            queueLength = pending[0];
          } else if (Array.isArray(pending)) {
            queueLength = pending.length;
          }
        } catch {
          queueLength = 0;
        }

        const health: Record<string, unknown> = {
          status: 'healthy',
          uptime: Date.now() - this.startTime,
          timestamp: new Date().toISOString(),
          queueLength,
        };

        if (this.statusProvider) {
          const providerData = await this.statusProvider();
          Object.assign(health, providerData);
        }

        res.json(health);
      } catch (err) {
        res.status(503).json({
          status: 'unhealthy',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });
  }

  private server?: any;

  async start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        logger.info(`Health server listening on port ${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => resolve());
      });
    }
  }
}
