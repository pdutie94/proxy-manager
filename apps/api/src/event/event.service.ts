import { Injectable, Inject } from '@nestjs/common';
import { prisma, EventOutboxStatus } from '@proxy-manager/db';
import { ProxyEvent, ProxyEventType } from '@proxy-manager/common';
import { IRedisService } from '../redis/redis.service';

@Injectable()
export class EventService {
  private redis: IRedisService;
  private readonly STREAM_KEY = 'proxy_events';

  constructor(@Inject('REDIS_SERVICE') redis: IRedisService) {
    this.redis = redis;
  }

  async publish(event: Omit<ProxyEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: ProxyEvent = {
      ...event,
      id: `${event.nodeId}-${event.proxyId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    // Save to outbox first (reliable delivery pattern)
    await prisma.eventOutbox.create({
      data: {
        type: fullEvent.type,
        payload: fullEvent as any,
        status: EventOutboxStatus.pending,
      },
    });

    // Try immediate publish
    await this.processOutbox();
  }

  async processOutbox(): Promise<void> {
    const pending = await prisma.eventOutbox.findMany({
      where: {
        status: { in: [EventOutboxStatus.pending, EventOutboxStatus.failed] },
        retryCount: { lt: 5 },
      },
      take: 100,
      orderBy: { createdAt: 'asc' },
    });

    for (const event of pending) {
      try {
        // Publish to Redis Streams
        await this.redis.xadd(
          this.STREAM_KEY,
          '*', // Auto-generate ID
          'data',
          JSON.stringify(event.payload),
        );

        // Mark as sent
        await prisma.eventOutbox.update({
          where: { id: event.id },
          data: {
            status: EventOutboxStatus.sent,
            sentAt: new Date(),
          },
        });
      } catch (error) {
        // Increment retry count
        await prisma.eventOutbox.update({
          where: { id: event.id },
          data: {
            status: EventOutboxStatus.failed,
            retryCount: { increment: 1 },
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        // Move to dead queue after max retries
        if (event.retryCount >= 4) {
          await prisma.eventOutbox.update({
            where: { id: event.id },
            data: { status: EventOutboxStatus.dead },
          });
        }
      }
    }
  }

  async getDeadEvents(): Promise<any[]> {
    return prisma.eventOutbox.findMany({
      where: { status: EventOutboxStatus.dead },
      orderBy: { createdAt: 'desc' },
    });
  }
}
