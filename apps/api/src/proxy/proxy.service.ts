import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { prisma, ProxyStatus } from '@proxy-manager/db';
import { ProxyEventType, generateCorrelationId, generateConfigHash } from '@proxy-manager/common';
import { EventService } from '../event/event.service';
import { AllocatorService } from '../allocator/allocator.service';

@Injectable()
export class ProxyService {
  constructor(
    private readonly eventService: EventService,
    private readonly allocatorService: AllocatorService,
  ) {}

  async create(data: {
    userId: number;
    nodeId?: number;
    expiresAt: string;
    idempotencyKey?: string;
  }) {
    // Check idempotency
    if (data.idempotencyKey) {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { key: data.idempotencyKey },
      });
      if (existing) {
        return existing.response;
      }
    }

    // Check backpressure
    const pendingCount = await prisma.proxy.count({
      where: { status: ProxyStatus.pending },
    });
    if (pendingCount > 1000) {
      throw new ConflictException('System overloaded, please try again later');
    }

    // Allocate resources
    const allocation = await this.allocatorService.allocate(data.nodeId);

    // Create proxy
    const proxy = await prisma.proxy.create({
      data: {
        userId: data.userId,
        nodeId: allocation.nodeId,
        ipPoolId: allocation.ipPoolId,
        portId: allocation.portId,
        username: this.generateUsername(),
        password: this.generatePassword(),
        status: ProxyStatus.pending,
        version: 1,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      },
    });

    // Publish event (outbox pattern)
    const correlationId = generateCorrelationId();
    const configHash = generateConfigHash({
      nodeId: proxy.nodeId,
      ipv6: allocation.ipv6,
      port: allocation.port,
      username: proxy.username,
      password: proxy.password,
    });

    await this.eventService.publish({
      type: ProxyEventType.PROXY_CREATE,
      nodeId: proxy.nodeId,
      proxyId: Number(proxy.id),
      ipv6: allocation.ipv6,
      port: allocation.port,
      username: proxy.username,
      password: proxy.password,
      expiresAt: proxy.expiresAt.toISOString(),
      version: 1,
      configHash,
      correlationId,
    });

    const result = {
      id: proxy.id.toString(),
      nodeId: proxy.nodeId,
      ipv6: allocation.ipv6,
      port: allocation.port,
      username: proxy.username,
      password: proxy.password,
      status: proxy.status,
      expiresAt: proxy.expiresAt,
    };

    // Save idempotency key
    if (data.idempotencyKey) {
      await prisma.idempotencyKey.create({
        data: {
          key: data.idempotencyKey,
          response: result as any,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    return result;
  }

  async list(userId?: number, nodeId?: number, status?: string) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (nodeId) where.nodeId = nodeId;
    if (status) where.status = status;
    
    return prisma.proxy.findMany({
      where,
      include: {
        node: { select: { id: true, name: true, ipAddress: true } },
        ipPool: { select: { ipv6: true } },
        port: { select: { port: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(id: number) {
    const proxy = await prisma.proxy.findUnique({ where: { id } });
    if (!proxy) throw new NotFoundException('Proxy not found');

    // Graceful delete: active -> suspended
    await prisma.proxy.update({
      where: { id },
      data: { status: ProxyStatus.suspended },
    });

    // Publish delete event
    await this.eventService.publish({
      type: ProxyEventType.PROXY_DELETE,
      nodeId: proxy.nodeId,
      proxyId: Number(proxy.id),
      version: proxy.version + 1,
      configHash: '',
      correlationId: generateCorrelationId(),
    });

    return { success: true };
  }

  async renew(id: number, expiresAt: string) {
    const proxy = await prisma.proxy.findUnique({ where: { id } });
    if (!proxy) throw new NotFoundException('Proxy not found');

    await prisma.proxy.update({
      where: { id },
      data: {
        expiresAt: new Date(expiresAt),
        status: ProxyStatus.active,
        version: { increment: 1 },
      },
    });

    await this.eventService.publish({
      type: ProxyEventType.PROXY_RENEW,
      nodeId: proxy.nodeId,
      proxyId: Number(proxy.id),
      expiresAt,
      version: proxy.version + 1,
      configHash: proxy.lastConfigHash || '',
      correlationId: generateCorrelationId(),
    });

    return { success: true };
  }

  async markApplied(id: number, configHash: string) {
    await prisma.proxy.update({
      where: { id },
      data: {
        status: ProxyStatus.active,
        lastConfigHash: configHash,
      },
    });
    return { success: true };
  }

  private generateUsername(): string {
    return `user_${Math.random().toString(36).slice(2, 8)}`;
  }

  private generatePassword(): string {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  }
}
