import { Controller, Post, Body, Param } from '@nestjs/common';
import { NodeService } from './node.service';

// Internal endpoints for Agent communication only
// Admin CRUD + SSH operations are in NodesController (/api/nodes)
@Controller('internal/nodes')
export class NodeController {
  constructor(private readonly nodeService: NodeService) {}

  @Post(':id/heartbeat')
  async heartbeat(
    @Param('id') id: string,
    @Body() data: { cpuUsage?: number; memoryUsage?: number; bandwidthUsage?: number },
  ) {
    return this.nodeService.heartbeat(parseInt(id), data);
  }

  @Post(':id/initialize-ports')
  async initializePorts(@Param('id') id: string) {
    await this.nodeService.initializeNode(parseInt(id));
    return { success: true, message: 'Port pool initialized' };
  }
}
