import { Controller, Get, Post, Put, Delete, Param, Body, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { NodeService } from '../node/node.service';
import { SshService } from './ssh.service';
import { PrismaService, Node, NodeStatus } from '@proxy-manager/db';
import { CreateNodeDto, UpdateNodeDto } from './dto/nodes.dto';
import { EventService } from '../event/event.service';
import { ProxyEventType, generateCorrelationId } from '@proxy-manager/common';

@Controller('nodes')
export class NodesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sshService: SshService,
    private readonly nodeService: NodeService,
    private readonly eventService: EventService
  ) {}

  @Get()
  async getAllNodes(@Query('status') status?: string) {
    const where = status ? { status: status as any } : {};
    
    const nodes = await this.prisma.node.findMany({
      where,
      include: {
        proxies: {
          select: {
            id: true,
            isActive: true,
            status: true
          }
        },
        _count: {
          select: {
            proxies: true
          }
        },
        region: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return nodes.map(node => ({
      ...node,
      proxyCount: node._count.proxies,
      activeProxyCount: node.proxies.filter(p => p.isActive).length
    }));
  }

  @Get(':id')
  async getNodeById(@Param('id') id: string) {
    const node = await this.prisma.node.findUnique({
      where: { id: parseInt(id) },
      include: {
        proxies: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            proxies: true
          }
        },
        region: true
      }
    });

    if (!node) {
      throw new NotFoundException('Node not found');
    }

    return {
      ...node,
      proxyCount: node._count.proxies,
      activeProxyCount: node.proxies.filter(p => p.isActive).length
    };
  }

  @Post()
  async createNode(@Body() createNodeDto: CreateNodeDto) {
    const node = await this.prisma.node.create({
      data: {
        name: createNodeDto.name,
        host: createNodeDto.host,
        ipAddress: createNodeDto.ipAddress,
        regionId: createNodeDto.regionId ? parseInt(createNodeDto.regionId) : undefined,
        sshPort: createNodeDto.sshPort || 22,
        sshUsername: createNodeDto.sshUsername,
        sshPassword: createNodeDto.sshPassword,
        sshPrivateKey: createNodeDto.sshPrivateKey,
        sshKeyPassphrase: createNodeDto.sshKeyPassphrase,
        proxyPortStart: createNodeDto.proxyPortStart || 10000,
        proxyPortEnd: createNodeDto.proxyPortEnd || 20000,
        maxPorts: createNodeDto.maxPorts || 60000,
        ipv6Subnet: createNodeDto.ipv6Subnet,
        status: NodeStatus.OFFLINE
      }
    });

    // Auto-initialize port pool in background
    this.nodeService.initializeNode(node.id).catch(err => {
      console.error(`Failed to auto-initialize port pool for node ${node.id}:`, err);
    });

    return node;
  }

  @Put(':id')
  async updateNode(@Param('id') id: string, @Body() updateNodeDto: UpdateNodeDto) {
    const oldNode = await this.prisma.node.findUnique({ where: { id: parseInt(id) } });

    const node = await this.prisma.node.update({
      where: { id: parseInt(id) },
      data: {
        name: updateNodeDto.name,
        host: updateNodeDto.host,
        ipAddress: updateNodeDto.ipAddress,
        regionId: updateNodeDto.regionId ? parseInt(updateNodeDto.regionId) : undefined,
        sshPort: updateNodeDto.sshPort,
        sshUsername: updateNodeDto.sshUsername,
        sshPassword: updateNodeDto.sshPassword,
        sshPrivateKey: updateNodeDto.sshPrivateKey,
        sshKeyPassphrase: updateNodeDto.sshKeyPassphrase,
        proxyPortStart: updateNodeDto.proxyPortStart,
        proxyPortEnd: updateNodeDto.proxyPortEnd,
        maxPorts: updateNodeDto.maxPorts,
        ipv6Subnet: updateNodeDto.ipv6Subnet,
        status: updateNodeDto.status
      }
    });

    // Trigger events if status changed to/from SUSPENDED
    if (oldNode?.status !== NodeStatus.SUSPENDED && node.status === NodeStatus.SUSPENDED) {
      await this.eventService.publish({
        type: ProxyEventType.NODE_SUSPEND,
        nodeId: node.id,
        proxyId: 0,
        version: 0,
        configHash: '',
        correlationId: generateCorrelationId(),
      });
    } else if (oldNode?.status === NodeStatus.SUSPENDED && node.status !== NodeStatus.SUSPENDED) {
      await this.eventService.publish({
        type: ProxyEventType.NODE_RESUME,
        nodeId: node.id,
        proxyId: 0,
        version: 0,
        configHash: '',
        correlationId: generateCorrelationId(),
      });
    }

    return node;
  }

  @Delete(':id')
  async deleteNode(@Param('id') id: string) {
    // Check if node exists
    const node = await this.prisma.node.findUnique({
      where: { id: parseInt(id) }
    });

    if (!node) {
      throw new NotFoundException('Node not found');
    }

    // Check if node has proxies
    const proxyCount = await this.prisma.proxy.count({
      where: { nodeId: parseInt(id) }
    });

    if (proxyCount > 0) {
      throw new BadRequestException(`Cannot delete node with ${proxyCount} existing proxies. Please delete all proxies first.`);
    }

    // Delete related records to avoid foreign key constraints
    await this.prisma.$transaction([
      this.prisma.nodeHeartbeat.deleteMany({ where: { nodeId: parseInt(id) } }),
      this.prisma.ipPool.deleteMany({ where: { nodeId: parseInt(id) } }),
      this.prisma.port.deleteMany({ where: { nodeId: parseInt(id) } }),
      this.prisma.node.delete({ where: { id: parseInt(id) } }),
    ]);

    return { message: 'Node deleted successfully' };
  }

  @Post(':id/check')
  async checkNode(@Param('id') id: string) {
    const node = await this.prisma.node.findUnique({
      where: { id: parseInt(id) }
    });

    if (!node) {
      throw new Error('Node not found');
    }

    // Perform actual SSH connection test
    const result = await this.sshService.testNodeConnection(node);
    
    // Update node status and lastChecked in DB
    await this.prisma.node.update({
      where: { id: parseInt(id) },
      data: {
        status: result.ok ? NodeStatus.ACTIVE : NodeStatus.OFFLINE,
        lastChecked: new Date(),
      }
    });

    // Return updated node with test results
    const updatedNode = await this.prisma.node.findUnique({
      where: { id: parseInt(id) }
    });

    return {
      node: updatedNode,
      testResult: result
    };
  }

  @Post(':id/initialize')
  async initializeNode(@Param('id') id: string, @Query('force') force?: string) {
    const node = await this.prisma.node.findUnique({
      where: { id: parseInt(id) }
    });

    if (!node) {
      throw new NotFoundException('Node not found');
    }

    // Perform node initialization via SSH
    const result = await this.sshService.initializeNode(node, force === 'true');
    
    // Update node status based on initialization result
    if (result.success) {
      await this.prisma.node.update({
        where: { id: parseInt(id) },
        data: { 
          status: NodeStatus.ACTIVE,
          is3ProxyInstalled: true,
          lastChecked: new Date(),
        }
      });
    } else {
      await this.prisma.node.update({
        where: { id: parseInt(id) },
        data: { status: NodeStatus.ERROR }
      });
    }
    
    // Return updated node with initialization results
    const updatedNode = await this.prisma.node.findUnique({
      where: { id: parseInt(id) }
    });

    return {
      node: updatedNode,
      initResult: result
    };
  }

  @Get(':id/stats')
  async getNodeStats(@Param('id') id: string) {
    const node = await this.prisma.node.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            proxies: true
          }
        },
        proxies: {
          select: {
            isActive: true,
            status: true
          }
        }
      }
    });

    if (!node) {
      throw new Error('Node not found');
    }

    const activeProxies = node.proxies.filter(p => p.isActive).length;
    const totalProxies = node._count.proxies;

    return {
      nodeId: node.id,
      nodeName: node.name,
      status: node.status,
      totalProxies,
      activeProxies,
      utilization: totalProxies > 0 ? Math.round((activeProxies / totalProxies) * 100) : 0,
      lastChecked: node.lastChecked,
      maxPorts: node.maxPorts,
      usedPorts: totalProxies
    };
  }

  @Get(':id/logs')
  async getNodeLogs(@Param('id') id: string) {
    const node = await this.prisma.node.findUnique({
      where: { id: parseInt(id) }
    });

    if (!node) {
      throw new NotFoundException('Node not found');
    }

    const logs = await this.sshService.getNodeLogs(node);
    return { logs };
  }

  @Post(':id/toggle')
  async toggleNodeStatus(@Param('id') id: string) {
    const node = await this.prisma.node.findUnique({
      where: { id: parseInt(id) }
    });

    if (!node) {
      throw new NotFoundException('Node not found');
    }

    const newStatus = node.status === NodeStatus.ACTIVE ? NodeStatus.OFFLINE : NodeStatus.ACTIVE;
    
    const updatedNode = await this.prisma.node.update({
      where: { id: parseInt(id) },
      data: { status: newStatus }
    });

    return updatedNode;
  }

  @Post(':id/suspend')
  async suspendNode(@Param('id') id: string) {
    const node = await this.prisma.node.update({
      where: { id: parseInt(id) },
      data: { status: NodeStatus.SUSPENDED }
    });

    await this.eventService.publish({
      type: ProxyEventType.NODE_SUSPEND,
      nodeId: node.id,
      proxyId: 0,
      version: 0,
      configHash: '',
      correlationId: generateCorrelationId(),
    });

    return node;
  }

  @Post(':id/resume')
  async resumeNode(@Param('id') id: string) {
    const node = await this.prisma.node.update({
      where: { id: parseInt(id) },
      data: { status: NodeStatus.ACTIVE }
    });

    await this.eventService.publish({
      type: ProxyEventType.NODE_RESUME,
      nodeId: node.id,
      proxyId: 0,
      version: 0,
      configHash: '',
      correlationId: generateCorrelationId(),
    });

    return node;
  }
}
