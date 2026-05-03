import express from 'express';
import Redis from 'ioredis';

export class HealthServer {
  private app: express.Application;
  private redis: Redis;
  private startTime = Date.now();

  constructor(redis: Redis) {
    this.app = express();
    this.redis = redis;
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.get('/health', async (req, res) => {
      try {
        // Check Redis connection
        await this.redis.ping();

        const health = {
          status: 'healthy',
          uptime: Date.now() - this.startTime,
          timestamp: new Date().toISOString(),
        };

        res.json(health);
      } catch (err) {
        res.status(503).json({
          status: 'unhealthy',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });
  }

  async start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        console.log(`Health server listening on port ${port}`);
        resolve();
      });
    });
  }
}
