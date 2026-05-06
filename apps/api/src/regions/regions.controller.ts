import { Controller, Get, Post, Put, Delete, Param, Body, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@proxy-manager/db';
import { CreateRegionDto, UpdateRegionDto } from './dto/regions.dto';

@Controller('regions')
export class RegionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getAllRegions(@Query('isActive') isActive?: string) {
    const where = isActive !== undefined ? { isActive: isActive === 'true' } : {};
    
    const regions = await this.prisma.region.findMany({
      where,
      include: {
        _count: {
          select: {
            nodes: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return regions;
  }

  @Get(':id')
  async getRegionById(@Param('id') id: string) {
    const region = await this.prisma.region.findUnique({
      where: { id: parseInt(id) },
      include: {
        nodes: {
          select: {
            id: true,
            name: true,
            status: true,
            ipAddress: true
          }
        },
        _count: {
          select: {
            nodes: true
          }
        }
      }
    });

    if (!region) {
      throw new NotFoundException('Region not found');
    }

    return region;
  }

  @Post()
  async createRegion(@Body() createRegionDto: CreateRegionDto) {
    const region = await this.prisma.region.create({
      data: {
        name: createRegionDto.name,
        description: createRegionDto.description,
        isActive: createRegionDto.isActive ?? true
      }
    });

    return region;
  }

  @Put(':id')
  async updateRegion(@Param('id') id: string, @Body() updateRegionDto: UpdateRegionDto) {
    const region = await this.prisma.region.update({
      where: { id: parseInt(id) },
      data: {
        name: updateRegionDto.name,
        description: updateRegionDto.description,
        isActive: updateRegionDto.isActive
      }
    });

    return region;
  }

  @Delete(':id')
  async deleteRegion(@Param('id') id: string) {
    // Check if region has nodes
    const nodeCount = await this.prisma.node.count({
      where: { regionId: parseInt(id) }
    });

    if (nodeCount > 0) {
      throw new BadRequestException('Cannot delete region with existing nodes');
    }

    await this.prisma.region.delete({
      where: { id: parseInt(id) }
    });

    return { message: 'Region deleted successfully' };
  }

  @Get(':id/stats')
  async getRegionStats(@Param('id') id: string) {
    const region = await this.prisma.region.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            nodes: true
          }
        },
        nodes: {
          select: {
            status: true
          }
        }
      }
    });

    if (!region) {
      throw new NotFoundException('Region not found');
    }

    const totalNodes = region._count.nodes;
    const onlineNodes = region.nodes.filter((n: any) => n.status === 'ACTIVE').length;

    return {
      regionId: region.id,
      regionName: region.name,
      totalNodes,
      onlineNodes,
      offlineNodes: totalNodes - onlineNodes,
      isActive: region.isActive
    };
  }
}
