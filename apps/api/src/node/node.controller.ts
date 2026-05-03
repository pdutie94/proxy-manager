import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { NodeService } from './node.service';

@Controller('nodes')
export class NodeController {
  constructor(private readonly nodeService: NodeService) {}

  @Post()
  async create(@Body() data: { name: string; maxPorts: number; ipv6Subnet: string; ipAddress?: string; region?: string }) {
    return this.nodeService.create(data);
  }

  @Get()
  async list() {
    return this.nodeService.list();
  }

  @Post(':id/heartbeat')
  async heartbeat(
    @Param('id') id: string,
    @Body() data: { cpuUsage?: number; memoryUsage?: number; bandwidthUsage?: number },
  ) {
    return this.nodeService.heartbeat(parseInt(id), data);
  }

  @Post(':id/initialize')
  async initialize(@Param('id') id: string) {
    await this.nodeService.initializeNode(parseInt(id));
    return { success: true };
  }
}
