import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { CreateProxyDto, TrafficBatchDto } from './dto/proxy.dto';

@Controller('proxies')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Post()
  async create(@Body() data: CreateProxyDto) {
    return this.proxyService.create(data);
  }

  @Get()
  async list(
    @Query('userId') userId?: string,
    @Query('nodeId') nodeId?: string,
    @Query('status') status?: string
  ) {
    return this.proxyService.list(
      userId ? parseInt(userId) : undefined,
      nodeId ? parseInt(nodeId) : undefined,
      status
    );
  }

  @Post('traffic/batch')
  async recordTrafficBatch(@Body() data: TrafficBatchDto) {
    return this.proxyService.recordTrafficBatch(data.nodeId, data.records);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.proxyService.getById(parseInt(id));
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.proxyService.delete(parseInt(id));
  }

  @Post(':id/renew')
  async renew(@Param('id') id: string, @Body('expiresAt') expiresAt: string) {
    return this.proxyService.renew(parseInt(id), expiresAt);
  }

  @Post(':id/applied')
  async markApplied(@Param('id') id: string, @Body('configHash') configHash: string) {
    return this.proxyService.markApplied(parseInt(id), configHash);
  }
}
