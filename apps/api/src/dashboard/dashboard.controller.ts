import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '@proxy-manager/db';
import { Node, Proxy, Notification } from '@prisma/client';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  async getOverview() {
    const [activeProxies, totalProxies, activeServers, totalServers] = await Promise.all([
      this.prisma.proxy.count({ where: { isActive: true } }),
      this.prisma.proxy.count(),
      this.prisma.node.count({ where: { status: 'ACTIVE' } }),
      this.prisma.node.count()
    ]);

    const onlineNodesPercentage = totalServers > 0 ? (activeServers / totalServers) * 100 : 0;

    return {
      activeProxies,
      totalProxies,
      activeProxiesChange: 0, // TODO: Calculate from historical data
      pendingApplication: 0, // TODO: Implement application system
      pendingApplicationPercentage: 0,
      onlineNodes: activeServers,
      totalNodes: totalServers,
      onlineNodesPercentage: Math.round(onlineNodesPercentage * 10) / 10,
      redisQueue: 0, // TODO: Implement Redis queue monitoring
      lastUpdated: new Date().toISOString(),
      systemActive: true
    };
  }

  @Get('nodes-status')
  async getNodesStatus() {
    const nodes = await this.prisma.node.findMany({
      include: {
        proxies: {
          where: { isActive: true }
        }
      }
    });

    return nodes.map((node: Node & { proxies: Proxy[] }) => {
      const proxyCount = node.proxies.length;
      const utilization = proxyCount > 0 ? Math.min(100, (proxyCount / 100) * 100) : 0; // Assuming max 100 proxies per node
      
      let status: 'online' | 'offline' | 'warning' = 'offline';
      if (node.status === 'ACTIVE') {
        status = utilization > 80 ? 'warning' : 'online';
      }

      return {
        id: node.name,
        name: node.name,
        proxyCount,
        utilization: Math.round(utilization),
        status
      };
    });
  }

  @Get('system-status')
  async getSystemStatus() {
    const [totalProxies, activeServers, totalServers] = await Promise.all([
      this.prisma.proxy.count(),
      this.prisma.node.count({ where: { status: 'ACTIVE' } }),
      this.prisma.node.count()
    ]);

    return [
      {
        name: 'API',
        status: 'active',
        description: 'Hoạt động'
      },
      {
        name: 'Database',
        status: 'connected',
        description: 'Kết nối'
      },
      {
        name: 'Servers',
        status: activeServers > 0 ? 'active' : 'error',
        description: `${activeServers}/${totalServers} online`,
        value: activeServers
      },
      {
        name: 'Active Proxies',
        status: 'running',
        description: `${totalProxies} proxy`,
        value: totalProxies
      },
      {
        name: 'System Health',
        status: 'running',
        description: 'Đang chạy'
      }
    ];
  }

  @Get('recent-events')
  async getRecentEvents() {
    const recentProxies = await this.prisma.proxy.findMany({
      include: {
        node: true,
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    return recentProxies.map((proxy: Proxy & { node?: Node; user?: any }) => {
      const now = new Date();
      const createdTime = new Date(proxy.createdAt);
      const timeDiff = Math.floor((now.getTime() - createdTime.getTime()) / (1000 * 60)); // minutes
      
      let timeText = `${timeDiff} phút trước`;
      if (timeDiff < 1) timeText = 'Vừa xong';
      else if (timeDiff >= 60) timeText = `${Math.floor(timeDiff / 60)} giờ trước`;

      let type: 'CREATE_PROXY' | 'DELETE_PROXY' | 'RENEW_PROXY' | 'EXPIRED_PROXY' = 'CREATE_PROXY';
      let title = 'TẠO PROXY';
      let status: 'applied' | 'pending' | 'warning' = 'applied';

      if (!proxy.isActive) {
        type = 'DELETE_PROXY';
        title = 'XÓA PROXY';
        status = 'applied';
      } else if (proxy.expiresAt && new Date(proxy.expiresAt) < now) {
        type = 'EXPIRED_PROXY';
        title = 'HẾT HẠN';
        status = 'warning';
      } else if (proxy.expiresAt && new Date(proxy.expiresAt).getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
        type = 'RENEW_PROXY';
        title = 'GIA HẠN PROXY';
        status = 'pending';
      }

      return {
        id: `PX-${proxy.id}`,
        type,
        title,
        node: proxy.node?.name || 'Unknown',
        time: timeText,
        status,
        timestamp: proxy.createdAt.toISOString()
      };
    });
  }

  @Get('alerts')
  async getAlerts() {
    const [expiringProxies, offlineNodes, recentNotifications] = await Promise.all([
      // Get proxies expiring in 24 hours
      this.prisma.proxy.findMany({
        where: {
          isActive: true,
          expiresAt: {
            lte: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }
        },
        include: {
          node: true
        }
      }),
      // Get offline nodes
      this.prisma.node.findMany({
        where: {
          status: {
            in: ['ERROR', 'OFFLINE']
          }
        }
      }),
      // Get recent notifications
      this.prisma.notification.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      })
    ]);

    const alerts = [];

    // Add expiring proxies alerts
    if (expiringProxies.length > 0) {
      alerts.push({
        id: 'ALT-EXP-001',
        type: 'warning',
        title: 'Proxy Expiring Soon',
        message: `${expiringProxies.length} proxies will expire in 24 hours`,
        time: 'Vừa xong',
        timestamp: new Date().toISOString()
      });
    }

    // Add offline nodes alerts
    offlineNodes.forEach((node: Node) => {
      alerts.push({
        id: `ALT-NODE-${node.id}`,
        type: 'error',
        title: 'Node Offline',
        message: `Node ${node.name} is offline or has errors`,
        time: 'Vừa xong',
        timestamp: new Date().toISOString()
      });
    });

    // Add system notifications
    recentNotifications.forEach((notification: Notification) => {
      const now = new Date();
      const createdTime = new Date(notification.createdAt);
      const timeDiff = Math.floor((now.getTime() - createdTime.getTime()) / (1000 * 60));
      
      let timeText = `${timeDiff} phút trước`;
      if (timeDiff < 1) timeText = 'Vừa xong';
      else if (timeDiff >= 60) timeText = `${Math.floor(timeDiff / 60)} giờ trước`;

      let type: 'warning' | 'error' | 'info' = 'info';
      if (notification.type === 'PROXY_EXPIRED' || notification.type === 'SYSTEM') {
        type = 'error';
      } else if (notification.type === 'PROXY_EXPIRING_SOON') {
        type = 'warning';
      }

      alerts.push({
        id: `ALT-NOT-${notification.id}`,
        type,
        title: notification.title,
        message: notification.message,
        time: timeText,
        timestamp: notification.createdAt.toISOString()
      });
    });

    return alerts.slice(0, 10); // Limit to 10 most recent alerts
  }
}
