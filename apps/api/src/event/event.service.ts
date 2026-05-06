import { Injectable, Inject } from '@nestjs/common';
import { PrismaService, EventOutboxStatus } from '@proxy-manager/db';
import { ProxyEvent, ProxyEventType } from '@proxy-manager/common';
import { IRedisService } from '../redis/redis.service';
import { createHmac } from 'crypto';

@Injectable()
export class EventService {
  private redis: IRedisService;
  private readonly STREAM_KEY = 'proxy_events';

  constructor(
    @Inject('REDIS_SERVICE') redis: IRedisService,
    private readonly prisma: PrismaService
  ) {
    this.redis = redis;
  }

  async publish(event: Omit<ProxyEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: ProxyEvent = {
      ...event,
      id: `${event.nodeId}-${event.proxyId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };

    // Save to outbox first (reliable delivery pattern)
    await this.prisma.eventOutbox.create({
      data: {
        type: fullEvent.type,
        payload: fullEvent as any,
        status: EventOutboxStatus.PENDING,
      },
    });

    // Try immediate publish in background to avoid blocking
    this.processOutbox().catch(err => {
      console.error('Failed to process outbox in background:', err);
    });
  }

  async processOutbox(): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Use FOR UPDATE SKIP LOCKED to prevent race conditions in distributed environment
      const pending = await tx.$queryRaw<any[]>`
        SELECT id, payload, retry_count as "retryCount"
        FROM event_outbox
        WHERE status IN (${EventOutboxStatus.PENDING}, ${EventOutboxStatus.FAILED})
          AND retry_count < 5
        ORDER BY created_at ASC
        LIMIT 100
        FOR UPDATE SKIP LOCKED
      `;

      if (!pending || pending.length === 0) return;

      for (const event of pending) {
        try {
          // HMAC Signing
          const secret = process.env.HMAC_SECRET || 'dev-secret';
          // Ensure payload is an object
          const payloadObj = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
          const dataToSign = JSON.stringify(payloadObj);
          const signature = createHmac('sha256', secret).update(dataToSign).digest('hex');
          
          const payloadWithSignature = { ...payloadObj, signature };

          // Publish to Redis Streams
          await this.redis.xadd(
            this.STREAM_KEY,
            '*', // Auto-generate ID
            'data',
            JSON.stringify(payloadWithSignature),
          );

          // Mark as sent
          await tx.eventOutbox.update({
            where: { id: event.id },
            data: {
              status: EventOutboxStatus.SENT,
              sentAt: new Date(),
            },
          });
        } catch (error) {
          // Increment retry count
          await tx.eventOutbox.update({
            where: { id: event.id },
            data: {
              status: EventOutboxStatus.FAILED,
              retryCount: { increment: 1 },
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          });

          // Move to dead queue after max retries
          if (event.retryCount >= 4) {
            await tx.eventOutbox.update({
              where: { id: event.id },
              data: { status: EventOutboxStatus.DEAD },
            });
          }
        }
      }
    });
  }

  async getDeadEvents(): Promise<any[]> {
    return this.prisma.eventOutbox.findMany({
      where: { status: EventOutboxStatus.DEAD },
      orderBy: { createdAt: 'desc' },
    });
  }
}
