import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService, ProxyStatus, EventOutboxStatus } from '@proxy-manager/db';
import { ProxyEvent, ProxyEventType, generateCorrelationId, generateConfigHash } from '@proxy-manager/common';
import { randomBytes } from 'crypto';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
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
    username?: string;
    password?: string;
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
        const username = data.username || this.generateUsername();
        const password = data.password || this.generatePassword();

        const proxy = await tx.proxy.create({
          data: {
            userId: data.userId,
            nodeId: alloc.nodeId,
            ipPoolId: alloc.ipPoolId,
            portId: alloc.portId,
            username,
            password,
            status: ProxyStatus.ACTIVE,
            version: 1,
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
          },
        });

      // Create audit log inside transaction
      await tx.auditLog.create({
        data: {
          userId: data.userId,
          action: 'CREATE',
          entityType: 'PROXY',
          entityId: proxy.id,
          details: { nodeId: alloc.nodeId, portId: alloc.portId.toString() },
        },
      });

      return proxy;
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
    
    const proxies = await this.prisma.proxy.findMany({
      where,
      include: {
        node: { select: { id: true, name: true, ipAddress: true } },
        ipPool: { select: { ipv6: true } },
        port: { select: { port: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return proxies.map(proxy => ({
      ...proxy,
      id: proxy.id.toString(),
      ipv6: proxy.ipPool?.ipv6,
      port: proxy.port?.port,
    }));
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
      ipv6: proxy.ipPool?.ipv6,
      port: proxy.port?.port,
    };
  }

  async createBulk(data: {
    userId: number;
    nodeId?: number;
    expiresAt: string;
    count: number;
  }) {
    const results = [];
    // Basic backpressure check for the whole batch
    const pendingCount = await this.prisma.proxy.count({
      where: { status: ProxyStatus.PENDING },
    });
    if (pendingCount + data.count > 2000) {
      throw new ConflictException('System overloaded, cannot accept large batch');
    }

    const sharedUsername = this.generateUsername();
    const sharedPassword = this.generatePassword();

    for (let i = 0; i < data.count; i++) {
      try {
        const result = await this.create({
          userId: data.userId,
          nodeId: data.nodeId,
          expiresAt: data.expiresAt,
          username: sharedUsername,
          password: sharedPassword,
        });
        results.push(result);
      } catch (err) {
        console.error(`Failed to create proxy ${i + 1}/${data.count}:`, err);
      }
    }
    return { count: results.length, results };
  }

  async delete(id: number) {
    const proxy = await this.prisma.proxy.findUnique({ where: { id } });
    if (!proxy) throw new NotFoundException('Proxy not found');

    // Graceful delete: active -> suspended, set deletedAt for future cleanup
    const deletedAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes grace period

    await this.prisma.$transaction(async (tx) => {
      await tx.proxy.update({
        where: { id },
        data: { 
          status: ProxyStatus.SUSPENDED,
          deletedAt: deletedAt,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: proxy.userId,
          action: 'DELETE',
          entityType: 'PROXY',
          entityId: proxy.id,
          details: { nodeId: proxy.nodeId, graceful: true },
        },
      });
    });

    // Still publish delete event immediately to stop traffic at Agent level
    await this.eventService.publish({
      type: ProxyEventType.PROXY_DELETE,
      nodeId: proxy.nodeId,
      proxyId: Number(proxy.id),
      version: proxy.version + 1,
      configHash: '',
      correlationId: generateCorrelationId(),
    });

    return { success: true, deletedAt };
  }

  async deleteBulk(ids: number[]) {
    const results = [];
    for (const id of ids) {
      try {
        await this.delete(id);
        results.push(id);
      } catch (err) {
        console.error(`Failed to delete proxy ${id}:`, err);
      }
    }
    return { count: results.length, ids: results };
  }

  async renew(id: number, expiresAt: string) {
    const proxy = await this.prisma.proxy.findUnique({ where: { id } });
    if (!proxy) throw new NotFoundException('Proxy not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.proxy.update({
        where: { id },
        data: {
          expiresAt: new Date(expiresAt),
          status: ProxyStatus.ACTIVE,
          version: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: proxy.userId,
          action: 'RENEW',
          entityType: 'PROXY',
          entityId: proxy.id,
          details: { expiresAt },
        },
      });
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

  async checkConnection(id: number) {
    const proxy = await this.prisma.proxy.findUnique({
      where: { id },
      include: {
        node: true,
        ipPool: true,
        port: true,
      },
    });

    if (!proxy || !proxy.ipPool || !proxy.port || !proxy.node) {
      throw new NotFoundException('Proxy or related resources not found');
    }

    const proxyUrl = `socks5://${proxy.username}:${proxy.password}@${proxy.node.ipAddress}:${proxy.port.port}`;
    const agent = new SocksProxyAgent(proxyUrl);
    
    const start = Date.now();
    try {
      const res = await axios.get('http://api.ipify.org?format=json', {
        httpAgent: agent,
        httpsAgent: agent,
        timeout: 10000,
      });
      const latency = Date.now() - start;
      
      await this.prisma.proxy.update({
        where: { id },
        data: { lastChecked: new Date() }
      });

      return { ok: true, ip: res.data.ip, latency };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  private generateUsername(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generatePassword(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
