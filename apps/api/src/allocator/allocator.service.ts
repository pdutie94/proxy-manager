import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService, NodeStatus, IpStatus, PortStatus, ProxyStatus } from '@proxy-manager/db';
import { CONFIG } from '@proxy-manager/common';

@Injectable()
export class AllocatorService {
  constructor(private readonly prisma: PrismaService) {}

  async allocate<T = any>(
    requestedNodeId?: number,
    onAllocate?: (tx: any, allocation: { nodeId: number; ipPoolId: bigint; portId: bigint; ipv6: string; port: number }) => Promise<T>
  ): Promise<{
    nodeId: number;
    ipPoolId: bigint;
    portId: bigint;
    ipv6: string;
    port: number;
    result?: T;
  }> {
    // Select node if not specified
    const nodeId = requestedNodeId || (await this.selectNode());
    if (!nodeId) {
      throw new ConflictException('No available nodes');
    }

    // Verify node exists and is active
    const node = await this.prisma.node.findUnique({
      where: { id: nodeId, status: NodeStatus.ACTIVE },
    });
    if (!node) {
      throw new ConflictException('Node not found or inactive');
    }

    // Transaction: allocate port + IP
    return await this.prisma.$transaction(async (tx) => {
      // 1. Find and lock free port
      const port = await tx.$queryRaw<{ id: bigint; port: number }[]>`
        SELECT id, port FROM ports
        WHERE node_id = ${nodeId} AND status = ${PortStatus.FREE}
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;

      if (!port || port.length === 0) {
        throw new ConflictException('No free ports available on node');
      }

      // 2. Find free IP or generate new one
      let ip = await tx.ipPool.findFirst({
        where: {
          nodeId,
          status: IpStatus.FREE,
        },
      });

      // Lazy generate IPv6 if none available
      if (!ip && node.ipv6Subnet) {
        await this.batchGenerateIpv6(tx, nodeId, node.ipv6Subnet, 100);
        // Re-query for one of the newly generated IPs
        ip = await tx.ipPool.findFirst({
          where: { nodeId, status: IpStatus.FREE },
        });
      }

      if (!ip) {
        throw new ConflictException('No free IPs available on node');
      }

      // 3. Mark resources as used
      await tx.port.update({
        where: { id: port[0].id },
        data: { status: PortStatus.USED },
      });

      await tx.ipPool.update({
        where: { id: ip.id },
        data: {
          status: IpStatus.IN_USE,
          lastUsedAt: new Date(),
          usageCount: { increment: 1 },
        },
      });

      const allocation = {
        nodeId,
        ipPoolId: ip.id,
        portId: port[0].id,
        ipv6: ip.ipv6,
        port: port[0].port,
      };

      let result: T | undefined;
      if (onAllocate) {
        result = await onAllocate(tx, allocation);
      }

      return {
        ...allocation,
        result,
      };
    }, {
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 10000,
    });
  }

  async release(proxyId: bigint): Promise<void> {
    const proxy = await this.prisma.proxy.findUnique({
      where: { id: proxyId },
      include: { ipPool: true, port: true },
    });

    if (!proxy) return;

    await this.prisma.$transaction(async (tx) => {
      // Release port (immediately reusable)
      await tx.port.update({
        where: { id: proxy.portId },
        data: { status: PortStatus.FREE },
      });

      // Release IP (cooldown period)
      await tx.ipPool.update({
        where: { id: proxy.ipPoolId },
        data: {
          status: IpStatus.COOLING,
          cooldownUntil: new Date(Date.now() + CONFIG.IPV6_COOLDOWN_MINUTES * 60 * 1000),
        },
      });
    });
  }

  private async selectNode(): Promise<number | null> {
    // Weight = available ports - active proxies
    const nodes = await this.prisma.node.findMany({
      where: { status: NodeStatus.ACTIVE },
      include: {
        _count: {
          select: {
            ports: { where: { status: PortStatus.FREE } },
            proxies: { where: { status: { not: ProxyStatus.EXPIRED } } },
          },
        },
      },
    });

    if (nodes.length === 0) return null;

    // Calculate weight and select best node
    const weightedNodes = nodes.map(node => ({
      id: node.id,
      weight: node._count.ports - node._count.proxies,
    }));

    weightedNodes.sort((a, b) => b.weight - a.weight);
    return weightedNodes[0].weight > 0 ? weightedNodes[0].id : null;
  }

  private async batchGenerateIpv6(
    tx: any,
    nodeId: number,
    subnet: string,
    count: number = 100
  ): Promise<void> {
    const ips = [];
    const baseSubnet = subnet.replace(/\/64$/, '');

    for (let i = 0; i < count; i++) {
      const suffix = Array.from({ length: 4 }, () =>
        Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')
      ).join(':');
      ips.push({
        nodeId,
        ipv6: `${baseSubnet}${suffix}`,
        status: IpStatus.FREE,
      });
    }

    await tx.ipPool.createMany({
      data: ips,
      skipDuplicates: true,
    });
  }
}
