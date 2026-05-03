import { Injectable, ConflictException } from '@nestjs/common';
import { prisma, NodeStatus, IpStatus, PortStatus } from '@proxy-manager/db';
import { CONFIG } from '@proxy-manager/common';

@Injectable()
export class AllocatorService {
  async allocate(requestedNodeId?: number): Promise<{
    nodeId: number;
    ipPoolId: bigint;
    portId: bigint;
    ipv6: string;
    port: number;
  }> {
    // Select node if not specified
    const nodeId = requestedNodeId || (await this.selectNode());
    if (!nodeId) {
      throw new ConflictException('No available nodes');
    }

    // Verify node exists and is active
    const node = await prisma.node.findUnique({
      where: { id: nodeId, status: NodeStatus.active },
    });
    if (!node) {
      throw new ConflictException('Node not found or inactive');
    }

    // Transaction: allocate port + IP
    return await prisma.$transaction(async (tx) => {
      // 1. Find and lock free port
      const port = await tx.$queryRaw<{ id: bigint; port: number }[]>`
        SELECT id, port FROM ports
        WHERE node_id = ${nodeId} AND status = ${PortStatus.free}
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
          status: IpStatus.free,
        },
      });

      // Lazy generate IPv6 if none available
      if (!ip && node.ipv6Subnet) {
        ip = await this.generateIpv6(tx, nodeId, node.ipv6Subnet);
      }

      if (!ip) {
        throw new ConflictException('No free IPs available on node');
      }

      // 3. Mark resources as used
      await tx.port.update({
        where: { id: port[0].id },
        data: { status: PortStatus.used },
      });

      await tx.ipPool.update({
        where: { id: ip.id },
        data: {
          status: IpStatus.in_use,
          lastUsedAt: new Date(),
          usageCount: { increment: 1 },
        },
      });

      return {
        nodeId,
        ipPoolId: ip.id,
        portId: port[0].id,
        ipv6: ip.ipv6,
        port: port[0].port,
      };
    }, {
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 10000,
    });
  }

  async release(proxyId: bigint): Promise<void> {
    const proxy = await prisma.proxy.findUnique({
      where: { id: proxyId },
      include: { ipPool: true, port: true },
    });

    if (!proxy) return;

    await prisma.$transaction(async (tx) => {
      // Release port (immediately reusable)
      await tx.port.update({
        where: { id: proxy.portId },
        data: { status: PortStatus.free },
      });

      // Release IP (cooldown period)
      await tx.ipPool.update({
        where: { id: proxy.ipPoolId },
        data: {
          status: IpStatus.cooling,
          cooldownUntil: new Date(Date.now() + CONFIG.IPV6_COOLDOWN_MINUTES * 60 * 1000),
        },
      });
    });
  }

  private async selectNode(): Promise<number | null> {
    // Weight = available ports - active proxies
    const nodes = await prisma.node.findMany({
      where: { status: NodeStatus.active },
      include: {
        _count: {
          select: {
            ports: { where: { status: PortStatus.free } },
            proxies: { where: { status: { not: 'expired' } } },
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

  private async generateIpv6(
    tx: any,
    nodeId: number,
    subnet: string,
  ): Promise<{ id: bigint; nodeId: number; ipv6: string; status: IpStatus; createdAt: Date; cooldownUntil: Date | null; lastUsedAt: Date | null; usageCount: number }> {
    // Generate random IPv6 suffix from /64 subnet
    // Example: 2001:db8::/64 -> 2001:db8::xxxx:xxxx:xxxx:xxxx
    const suffix = Array.from({ length: 4 }, () =>
      Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')
    ).join(':');

    const ipv6 = `${subnet}${suffix}`;

    // Check if already exists
    const existing = await tx.ipPool.findFirst({
      where: { ipv6 },
    });

    if (existing) {
      // Retry with different suffix (recursion with limit)
      return this.generateIpv6(tx, nodeId, subnet);
    }

    // Create new IP
    return await tx.ipPool.create({
      data: {
        nodeId,
        ipv6,
        status: IpStatus.in_use,
        lastUsedAt: new Date(),
        usageCount: 1,
      },
    });
  }
}
