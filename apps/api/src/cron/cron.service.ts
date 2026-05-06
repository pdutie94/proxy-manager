import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { PrismaService, ProxyStatus, EventOutboxStatus, IpStatus } from '@proxy-manager/db';
import { ProxyEventType, generateCorrelationId } from '@proxy-manager/common';
import { EventService } from '../event/event.service';
import { NodeService } from '../node/node.service';
import { AllocatorService } from '../allocator/allocator.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    private readonly nodeService: NodeService,
    private readonly allocatorService: AllocatorService,
  ) {}

  // Every minute: Check expired proxies
  @Cron('0 * * * * *')
  async checkExpiredProxies(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.proxy.findMany({
      where: {
        status: { in: [ProxyStatus.ACTIVE, ProxyStatus.PENDING] },
        expiresAt: { lt: now },
      },
    });

    if (expired.length === 0) return;

    // Update status in batch
    await this.prisma.proxy.updateMany({
      where: { id: { in: expired.map(p => p.id) } },
      data: { status: ProxyStatus.EXPIRED },
    });

    for (const proxy of expired) {
      try {
        // Release resources
        await this.allocatorService.release(proxy.id);

        // Publish expire event
        await this.eventService.publish({
          type: ProxyEventType.PROXY_EXPIRE,
          nodeId: proxy.nodeId,
          proxyId: Number(proxy.id),
          version: proxy.version + 1,
          configHash: '',
          correlationId: generateCorrelationId(),
        });

        this.logger.log(`Proxy ${proxy.id} expired`);
      } catch (err) {
        this.logger.error(`Failed to process expired proxy ${proxy.id}:`, err);
      }
    }
  }

  // Every minute: Check pending proxy timeout
  @Cron('30 * * * * *')
  async checkPendingTimeout(): Promise<void> {
    const timeout = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes

    const pending = await this.prisma.proxy.findMany({
      where: {
        status: ProxyStatus.PENDING,
        createdAt: { lt: timeout },
      },
    });

    for (const proxy of pending) {
      // Retry event publication
      await this.eventService.publish({
        type: ProxyEventType.PROXY_CREATE,
        nodeId: proxy.nodeId,
        proxyId: Number(proxy.id),
        version: proxy.version,
        configHash: proxy.lastConfigHash || '',
        correlationId: generateCorrelationId(),
      });

      this.logger.log(`Retry event for pending proxy ${proxy.id}`);
    }

    // Mark as error after multiple retries (3+ attempts)
    const errorTimeout = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes
    await this.prisma.proxy.updateMany({
      where: {
        status: ProxyStatus.PENDING,
        createdAt: { lt: errorTimeout },
      },
      data: { status: ProxyStatus.ERROR },
    });
  }

  // Every 10 seconds: Process outbox
  @Interval(10000)
  async processOutbox(): Promise<void> {
    await this.eventService.processOutbox();
  }

  // Every 30 seconds: Check offline nodes
  @Interval(30000)
  async checkOfflineNodes(): Promise<void> {
    await this.nodeService.checkOfflineNodes();
  }

  // Every 5 minutes: Reconcile (API-side checks)
  @Cron('0 */5 * * * *')
  async reconcile(): Promise<void> {
    // Clean up old idempotency keys
    await this.prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    // Clean up old audit logs (keep 90 days)
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.log('Reconciliation complete');
  }

  // Every minute: Check IPs in cooldown that have passed their cooldown period
  @Cron('0 * * * * *')
  async resetCoolingIps(): Promise<void> {
    const now = new Date();
    
    const result = await this.prisma.ipPool.updateMany({
      where: {
        status: IpStatus.COOLING,
        cooldownUntil: { lte: now },
      },
      data: {
        status: IpStatus.FREE,
        cooldownUntil: null,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Reset ${result.count} cooled IPs back to FREE`);
    }
  }

  // Every minute: Process graceful deletes
  @Cron('0 * * * * *')
  async processGracefulDeletes(): Promise<void> {
    const now = new Date();
    const toDelete = await this.prisma.proxy.findMany({
      where: {
        status: ProxyStatus.SUSPENDED,
        deletedAt: { lte: now },
      },
    });

    if (toDelete.length === 0) return;

    for (const proxy of toDelete) {
      try {
        // Release resources (Port + IP cooldown)
        await this.allocatorService.release(proxy.id);

        // Mark as EXPIRED
        await this.prisma.proxy.update({
          where: { id: proxy.id },
          data: { status: ProxyStatus.EXPIRED },
        });

        this.logger.log(`Graceful delete completed for proxy ${proxy.id}`);
      } catch (err) {
        this.logger.error(`Failed to process graceful delete for proxy ${proxy.id}:`, err);
      }
    }
  }
}
