import { Injectable } from '@nestjs/common';
import { prisma, NodeStatus, PortStatus, ProxyStatus } from '@proxy-manager/db';
import { CONFIG } from '@proxy-manager/common';

@Injectable()
export class NodeService {
  async create(data: { name: string; maxPorts: number; ipv6Subnet: string; ipAddress?: string; region?: string }) {
    return prisma.node.create({
      data: {
        name: data.name,
        maxPorts: data.maxPorts,
        ipv6Subnet: data.ipv6Subnet,
        ipAddress: data.ipAddress || '127.0.0.1',
        region: data.region || 'local',
        status: NodeStatus.active,
      },
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
    await prisma.nodeHeartbeat.upsert({
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
    await prisma.node.updateMany({
      where: { id: nodeId, status: NodeStatus.offline },
      data: { status: NodeStatus.active },
    });

    return { success: true };
  }

  async checkOfflineNodes(): Promise<void> {
    const threshold = new Date(Date.now() - CONFIG.HEARTBEAT_TIMEOUT_SECONDS * 1000);

    const offlineNodes = await prisma.nodeHeartbeat.findMany({
      where: {
        lastSeen: { lt: threshold },
        node: { status: NodeStatus.active },
      },
      include: { node: true },
    });

    for (const heartbeat of offlineNodes) {
      // Mark node as offline
      await prisma.node.update({
        where: { id: heartbeat.nodeId },
        data: { status: NodeStatus.offline },
      });

      // Mark all active proxies as suspended
      await prisma.proxy.updateMany({
        where: {
          nodeId: heartbeat.nodeId,
          status: { in: [ProxyStatus.active, ProxyStatus.pending] },
        },
        data: { status: ProxyStatus.suspended },
      });
    }
  }

  async initializeNode(nodeId: number): Promise<void> {
    const node = await prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) throw new Error('Node not found');

    // Pre-generate port range if not exists
    const existingPorts = await prisma.port.count({ where: { nodeId } });
    if (existingPorts === 0) {
      const ports = [];
      for (let port = CONFIG.PORT_RANGE_START; port <= CONFIG.PORT_RANGE_END; port++) {
        ports.push({ nodeId, port, status: PortStatus.free });
      }

      // Batch insert
      const batchSize = 1000;
      for (let i = 0; i < ports.length; i += batchSize) {
        await prisma.port.createMany({
          data: ports.slice(i, i + batchSize),
          skipDuplicates: true,
        });
      }
    }
  }

  async list() {
    return prisma.node.findMany({
      include: {
        _count: {
          select: {
            ports: { where: { status: PortStatus.free } },
            proxies: { where: { status: { not: ProxyStatus.expired } } },
          },
        },
        heartbeats: { orderBy: { lastSeen: 'desc' }, take: 1 },
      },
    });
  }
}
