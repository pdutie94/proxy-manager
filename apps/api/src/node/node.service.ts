import { Injectable } from '@nestjs/common';
import { PrismaService, NodeStatus, PortStatus, ProxyStatus } from '@proxy-manager/db';
import { CONFIG } from '@proxy-manager/common';

@Injectable()
export class NodeService {
  constructor(private readonly prisma: PrismaService) {}
  async create(data: { name: string; maxPorts: number; ipv6Subnet: string; ipAddress?: string; regionId?: number }) {
    const nodeData: any = {
      name: data.name,
      maxPorts: data.maxPorts,
      ipv6Subnet: data.ipv6Subnet,
      ipAddress: data.ipAddress || '127.0.0.1',
      status: NodeStatus.OFFLINE,
    };
    
    if (data.regionId) {
      nodeData.regionId = data.regionId;
    }
    
    return this.prisma.node.create({
      data: nodeData,
    });
  }

  async heartbeat(
    nodeId: number,
    data: {
      cpuUsage?: number;
      memoryUsage?: number;
      bandwidthUsage?: number;
    },
  ) {
    await this.prisma.nodeHeartbeat.upsert({
      where: { nodeId },
      update: {
        lastSeen: new Date(),
        metrics: data as any,
      },
      create: {
        nodeId,
        lastSeen: new Date(),
        metrics: data as any,
      },
    });

    // Update node status if it was offline
    await this.prisma.node.updateMany({
      where: { id: nodeId, status: NodeStatus.OFFLINE },
      data: { status: NodeStatus.ACTIVE },
    });

    return { success: true };
  }

  async checkOfflineNodes(): Promise<void> {
    const threshold = new Date(Date.now() - CONFIG.HEARTBEAT_TIMEOUT_SECONDS * 1000);

    const offlineNodes = await this.prisma.nodeHeartbeat.findMany({
      where: {
        lastSeen: { lt: threshold },
        node: { status: NodeStatus.ACTIVE },
      },
      include: { node: true },
    });

    for (const heartbeat of offlineNodes) {
      // Mark node as offline
      await this.prisma.node.update({
        where: { id: heartbeat.nodeId },
        data: { status: NodeStatus.OFFLINE },
      });

      // Mark all active proxies as suspended
      await this.prisma.proxy.updateMany({
        where: {
          nodeId: heartbeat.nodeId,
          status: { in: [ProxyStatus.ACTIVE, ProxyStatus.PENDING] },
        },
        data: { status: ProxyStatus.SUSPENDED },
      });
    }
  }

  async initializeNode(nodeId: number): Promise<void> {
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) throw new Error('Node not found');

    // Pre-generate port range if not exists
    const existingPorts = await this.prisma.port.count({ where: { nodeId } });
    if (existingPorts === 0) {
      const ports = [];
      for (let port = CONFIG.PORT_RANGE_START; port <= CONFIG.PORT_RANGE_END; port++) {
        ports.push({ nodeId, port, status: PortStatus.FREE });
      }

      // Batch insert
      const batchSize = 1000;
      for (let i = 0; i < ports.length; i += batchSize) {
        await this.prisma.port.createMany({
          data: ports.slice(i, i + batchSize),
          skipDuplicates: true,
        });
      }
    }
  }

  async list() {
    return this.prisma.node.findMany({
      include: {
        region: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            ports: { where: { status: PortStatus.FREE } },
            proxies: { where: { status: { not: ProxyStatus.EXPIRED } } },
          },
        },
        heartbeats: { orderBy: { lastSeen: 'desc' }, take: 1 },
      },
    });
  }
}
