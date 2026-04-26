import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { SSHService } from '@/lib/ssh';

// POST /api/admin/proxies/check-expired - Check and disable expired proxies
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();

    // Find all expired proxies (expiresAt < now and still assigned)
    const expiredProxies = await prisma.proxy.findMany({
      where: {
        expiresAt: {
          lt: now
        },
        assignedTo: {
          not: null
        }
      },
      include: {
        server: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    const results = [];
    const errors = [];

    // Disable each expired proxy
    for (const proxy of expiredProxies) {
      try {
        // 1. Remove from 3proxy config on server
        const sshResult = await SSHService.deleteProxy(proxy.server, proxy.port);
        
        if (!sshResult.success) {
          throw new Error(`SSH failed: ${sshResult.error}`);
        }

        // 2. Update database - unassign and deactivate, but KEEP credentials for 3-day grace period
        const updatedProxy = await prisma.proxy.update({
          where: { id: proxy.id },
          data: {
            assignedTo: null,
            isActive: false
            // Note: username and password are kept for 3 days to allow re-rental with same credentials
          }
        });

        // 3. Create notification for customer (specific user)
        await prisma.notification.create({
          data: {
            targetType: 'SPECIFIC',
            type: 'PROXY_EXPIRED',
            title: 'Proxy đã hết hạn',
            message: `Proxy port ${proxy.port} trên server ${proxy.server.name} đã hết hạn và bị vô hiệu hóa. Bạn có thể gia hạn trong vòng 3 ngày để giữ nguyên thông tin đăng nhập.`,
            data: {
              proxyId: proxy.id,
              port: proxy.port,
              serverName: proxy.server.name,
              expiredAt: proxy.expiresAt,
            },
            recipients: {
              create: { userId: proxy.customer!.id },
            },
          },
        });

        results.push({
          proxyId: proxy.id,
          port: proxy.port,
          server: proxy.server.name,
          customer: proxy.customer,
          expiredAt: proxy.expiresAt,
          action: 'disabled'
        });
      } catch (error: any) {
        console.error(`Failed to disable expired proxy ${proxy.id}:`, error);
        errors.push({
          proxyId: proxy.id,
          port: proxy.port,
          error: error.message
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${expiredProxies.length} expired proxies`,
      disabled: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Check expired proxies error:', error);
    return NextResponse.json(
      { error: 'Failed to check expired proxies' },
      { status: 500 }
    );
  }
}

// GET /api/admin/proxies/check-expired - Just list expired proxies without disabling
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();

    // Check for proxies expiring soon (1, 3, 7 days) and create notifications
    const warningDays = [1, 3, 7];
    const notificationsCreated = [];

    for (const days of warningDays) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);

      const expiringProxies = await prisma.proxy.findMany({
        where: {
          expiresAt: {
            gte: new Date(targetDate.setHours(0, 0, 0, 0)),
            lt: new Date(targetDate.setHours(23, 59, 59, 999)),
          },
          assignedTo: {
            not: null,
          },
        },
        include: {
          server: {
            select: {
              id: true,
              name: true,
              host: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      for (const proxy of expiringProxies) {
        // Check if notification already exists for this proxy and day (within last 24h)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        const existingNotifications = await prisma.notification.findMany({
          where: {
            type: 'PROXY_EXPIRING_SOON',
            createdAt: {
              gte: oneDayAgo,
            },
          },
        });
        
        // Check if there's already a notification for this specific proxy
        const existingNotification = existingNotifications.find((n: any) => {
          const data = n.data as any;
          return data?.proxyId === proxy.id;
        });

        if (!existingNotification) {
          await prisma.notification.create({
            data: {
              targetType: 'SPECIFIC',
              type: 'PROXY_EXPIRING_SOON',
              title: `Proxy sắp hết hạn (${days} ngày)`,
              message: `Proxy port ${proxy.port} trên server ${proxy.server.name} sẽ hết hạn sau ${days} ngày. Vui lòng gia hạn để tiếp tục sử dụng.`,
              data: {
                proxyId: proxy.id,
                port: proxy.port,
                serverName: proxy.server.name,
                expiresAt: proxy.expiresAt,
                daysRemaining: days,
              },
              recipients: {
                create: { userId: proxy.customer!.id },
              },
            },
          });
          notificationsCreated.push({
            proxyId: proxy.id,
            port: proxy.port,
            customerId: proxy.customer!.id,
            daysRemaining: days,
          });
        }
      }
    }

    // Find all expired proxies
    const expiredProxies = await prisma.proxy.findMany({
      where: {
        expiresAt: {
          lt: now
        },
        assignedTo: {
          not: null
        }
      },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            host: true
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json({
      count: expiredProxies.length,
      proxies: expiredProxies
    });
  } catch (error) {
    console.error('List expired proxies error:', error);
    return NextResponse.json(
      { error: 'Failed to list expired proxies' },
      { status: 500 }
    );
  }
}
