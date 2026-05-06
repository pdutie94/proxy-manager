import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService, ProxyStatus } from '@proxy-manager/db';
import { ProxyEventType, generateCorrelationId, generateConfigHash } from '@proxy-manager/common';
import { EventService } from '../event/event.service';
import { AllocatorService } from '../allocator/allocator.service';

@Injectable()
export class ProxyService {
  constructor(
    private readonly prisma: PrismaService,
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
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { key: data.idempotencyKey },
      });
      if (existing) {
        return existing.response;
      }
    }

    // Check backpressure
    const pendingCount = await this.prisma.proxy.count({
      where: { status: ProxyStatus.PENDING },
    });
    if (pendingCount > 1000) {
      throw new ConflictException('System overloaded, please try again later');
    }

    // Allocate resources and create proxy in the same transaction
    const allocation = await this.allocatorService.allocate(data.nodeId, async (tx, alloc) => {
      return await tx.proxy.create({
        data: {
          userId: data.userId,
          nodeId: alloc.nodeId,
          ipPoolId: alloc.ipPoolId,
          portId: alloc.portId,
          username: this.generateUsername(),
          password: this.generatePassword(),
          status: ProxyStatus.PENDING,
          version: 1,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
        },
      });
    });

    const proxy = allocation.result!;

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
      await this.prisma.idempotencyKey.create({
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
    if (status) where.status = status.toUpperCase() as ProxyStatus;
    
    return this.prisma.proxy.findMany({
      where,
      include: {
        node: { select: { id: true, name: true, ipAddress: true } },
        ipPool: { select: { ipv6: true } },
        port: { select: { port: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: number) {
    const proxy = await this.prisma.proxy.findUnique({
      where: { id },
      include: {
        node: { select: { id: true, name: true, ipAddress: true } },
        ipPool: { select: { ipv6: true } },
        port: { select: { port: true } },
      },
    });

    if (!proxy) throw new NotFoundException('Proxy not found');

    return {
      ...proxy,
      id: proxy.id.toString(),
      ipPoolId: proxy.ipPoolId.toString(),
      portId: proxy.portId.toString(),
    };
  }

  async delete(id: number) {
    const proxy = await this.prisma.proxy.findUnique({ where: { id } });
    if (!proxy) throw new NotFoundException('Proxy not found');

    // Graceful delete: active -> suspended
    await this.prisma.proxy.update({
      where: { id },
      data: { status: ProxyStatus.SUSPENDED },
    });

    // Release resources immediately
    await this.allocatorService.release(proxy.id);

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
    const proxy = await this.prisma.proxy.findUnique({ where: { id } });
    if (!proxy) throw new NotFoundException('Proxy not found');

    await this.prisma.proxy.update({
      where: { id },
      data: {
        expiresAt: new Date(expiresAt),
        status: ProxyStatus.ACTIVE,
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
    await this.prisma.proxy.update({
      where: { id },
      data: {
        status: ProxyStatus.ACTIVE,
        lastConfigHash: configHash,
      },
    });
    return { success: true };
  }

  async recordTrafficBatch(nodeId: number, data: any[]) {
    // Basic implementation to avoid 404, full logic depends on BandwidthCollector
    // Currently we just log or ignore, the plan is to save to db
    console.log(`Received traffic batch from node ${nodeId} with ${data.length} records`);
    return { success: true };
  }

  private generateUsername(): string {
    return `user_${Math.random().toString(36).slice(2, 8)}`;
  }

  private generatePassword(): string {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  }
}
