import { Injectable, Logger } from '@nestjs/common';
import { Cron, Interval } from '@nestjs/schedule';
import { prisma, ProxyStatus, EventOutboxStatus } from '@proxy-manager/db';
import { ProxyEventType, generateCorrelationId } from '@proxy-manager/common';
import { EventService } from '../event/event.service';
import { NodeService } from '../node/node.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly eventService: EventService,
    private readonly nodeService: NodeService,
  ) {}

  // Every minute: Check expired proxies
  @Cron('0 * * * * *')
  async checkExpiredProxies(): Promise<void> {
    const now = new Date();
    const expired = await prisma.proxy.findMany({
      where: {
        status: { in: [ProxyStatus.active, ProxyStatus.pending] },
        expiresAt: { lt: now },
      },
    });

    for (const proxy of expired) {
      // Update status
      await prisma.proxy.update({
        where: { id: proxy.id },
        data: { status: ProxyStatus.expired },
      });

      // Release resources
      await this.releaseResources(proxy.id);

      // Publish expire event
      await this.eventService.publish({
        type: ProxyEventType.PROXY_EXPIRE,
        nodeId: proxy.nodeId,
        proxyId: proxy.id,
        version: proxy.version + 1,
        configHash: '',
        correlationId: generateCorrelationId(),
      });

      this.logger.log(`Proxy ${proxy.id} expired`);
    }
  }

  // Every minute: Check pending proxy timeout
  @Cron('30 * * * * *')
  async checkPendingTimeout(): Promise<void> {
    const timeout = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes

    const pending = await prisma.proxy.findMany({
      where: {
        status: ProxyStatus.pending,
        createdAt: { lt: timeout },
      },
    });

    for (const proxy of pending) {
      // Retry event publication
      await this.eventService.publish({
        type: ProxyEventType.PROXY_CREATE,
        nodeId: proxy.nodeId,
        proxyId: proxy.id,
        version: proxy.version,
        configHash: proxy.lastConfigHash || '',
        correlationId: generateCorrelationId(),
      });

      this.logger.log(`Retry event for pending proxy ${proxy.id}`);
    }

    // Mark as error after multiple retries (3+ attempts)
    const errorTimeout = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes
    await prisma.proxy.updateMany({
      where: {
        status: ProxyStatus.pending,
        createdAt: { lt: errorTimeout },
      },
      data: { status: ProxyStatus.error },
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
    await prisma.idempotencyKey.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    // Clean up old audit logs (keep 90 days)
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.log('Reconciliation complete');
  }

  private async releaseResources(proxyId: bigint): Promise<void> {
    const proxy = await prisma.proxy.findUnique({
      where: { id: proxyId },
      include: { ipPool: true, port: true },
    });

    if (!proxy) return;

    // Release port
    await prisma.port.update({
      where: { id: proxy.portId },
      data: { status: 'free' as any },
    });

    // Release IP with cooldown
    await prisma.ipPool.update({
      where: { id: proxy.ipPoolId },
      data: {
        status: 'cooling' as any,
        cooldownUntil: new Date(Date.now() + 30 * 60 * 1000), // 30 min
      },
    });
  }
}
