import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { SSHService } from '@/lib/ssh';
import { randomBytes } from 'crypto';

// POST /api/customer/proxies/[id]/renew - Renew/re-rent an expired proxy
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify customer access
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const proxyId = parseInt(params.id);
    if (isNaN(proxyId)) {
      return NextResponse.json({ error: 'Invalid proxy ID' }, { status: 400 });
    }

    const { additionalDays } = await request.json();

    if (!additionalDays || additionalDays < 1) {
      return NextResponse.json(
        { error: 'Additional days must be at least 1' },
        { status: 400 }
      );
    }

    // Find the proxy - must be previously assigned to this customer and expired/unassigned
    const proxy = await prisma.proxy.findFirst({
      where: {
        id: proxyId,
        OR: [
          { assignedTo: payload.sub }, // Still assigned but expired
          { assignedTo: null, isActive: false } // Unassigned after expiry
        ]
      },
      include: {
        server: true
      }
    });

    if (!proxy) {
      return NextResponse.json(
        { error: 'Proxy not found or not available for renewal' },
        { status: 404 }
      );
    }

    // Check if proxy was previously assigned to this customer
    // Note: Currently assigned proxies (even expired) or recently unassigned ones
    // with history would be eligible for renewal
    if (proxy.assignedTo !== payload.sub) {
      return NextResponse.json(
        { error: 'You can only renew proxies you previously rented' },
        { status: 403 }
      );
    }

    // Check grace period (3 days from expiry)
    const now = new Date();
    const expiryDate = proxy.expiresAt ? new Date(proxy.expiresAt) : now;
    const daysSinceExpiry = Math.floor((now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));
    const withinGracePeriod = daysSinceExpiry <= 3;

    // Use old credentials if within 3-day grace period, otherwise generate new
    let username = proxy.username;
    let password = proxy.password;
    let isNewCredentials = false;

    if (!withinGracePeriod || !username || !password) {
      // Generate new credentials after grace period or if missing
      username = `user${randomBytes(4).toString('hex')}`;
      password = randomBytes(8).toString('hex');
      isNewCredentials = true;
    }

    // Calculate new expiry date from now (not from old expiry)
    const newExpiryDate = new Date(now);
    newExpiryDate.setDate(newExpiryDate.getDate() + additionalDays);

    // 1. Re-enable proxy on server with new credentials
    const sshResult = await SSHService.createProxy(proxy.server, {
      port: proxy.port,
      protocol: proxy.protocol as 'HTTP' | 'SOCKS4' | 'SOCKS5',
      username,
      password
    });

    if (!sshResult.success) {
      return NextResponse.json(
        { error: `Failed to enable proxy on server: ${sshResult.error}` },
        { status: 500 }
      );
    }

    // 2. Update database
    const updatedProxy = await prisma.proxy.update({
      where: { id: proxyId },
      data: {
        assignedTo: payload.sub,
        isActive: true,
        expiresAt: newExpiryDate,
        username,  // Keep old or use new based on grace period
        password   // Keep old or use new based on grace period
      },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            host: true
          }
        }
      }
    });

    // 3. Create notification for successful renewal
    await prisma.notification.create({
      data: {
        targetType: 'SPECIFIC',
        type: 'PROXY_RENEWED',
        title: 'Proxy đã được gia hạn',
        message: `Proxy port ${proxy.port} trên server ${proxy.server.name} đã được gia hạn thành công thêm ${additionalDays} ngày. ${isNewCredentials ? 'Thông tin đăng nhập mới đã được cấp.' : 'Thông tin đăng nhập giữ nguyên.'}`,
        data: {
          proxyId: proxy.id,
          port: proxy.port,
          serverName: proxy.server.name,
          expiresAt: newExpiryDate,
          isNewCredentials,
        },
        recipients: {
          create: { userId: payload.sub },
        },
      },
    });

    return NextResponse.json({
      message: 'Proxy renewed successfully',
      proxy: updatedProxy,
      credentials: {
        username,
        password,
        isNew: isNewCredentials // Tell customer if they got new credentials
      },
      gracePeriodInfo: {
        daysSinceExpiry,
        withinGracePeriod
      },
      expiresAt: newExpiryDate.toISOString()
    });
  } catch (error) {
    console.error('Renew proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to renew proxy' },
      { status: 500 }
    );
  }
}
