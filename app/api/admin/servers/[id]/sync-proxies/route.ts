import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { SSHService } from '@/lib/ssh';
import { Protocol } from '@prisma/client';

// Force Node.js runtime - node-ssh requires fs module which is not available in Edge
export const runtime = 'nodejs';

// POST /api/admin/servers/[id]/sync-proxies - Sync proxies from 3proxy.cfg
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const serverId = parseInt(params.id);
    if (isNaN(serverId)) {
      return NextResponse.json({ error: 'Invalid server ID' }, { status: 400 });
    }

    // Get server details
    const server = await prisma.server.findUnique({
      where: { id: serverId }
    });

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    // Parse proxy config from server
    let parsedProxies;
    try {
      parsedProxies = await SSHService.parseProxyConfig(server);
    } catch (parseError: any) {
      return NextResponse.json({
        success: false,
        warning: true,
        message: 'Không thể đọc file cấu hình 3proxy',
        error: parseError.message
      }, { status: 200 });
    }

    // Get existing proxies from database
    const existingProxies = await prisma.proxy.findMany({
      where: { serverId }
    });

    const results = {
      added: 0,
      updated: 0,
      unchanged: 0,
      orphaned: 0,
      details: {
        added: [] as number[],
        updated: [] as number[],
        unchanged: [] as number[],
        orphaned: [] as number[]
      }
    };

    // Tạo map của existing proxies để dễ tra cứu
    const existingProxyMap = new Map(existingProxies.map(p => [p.port, p]));
    const processedPorts = new Set<number>();

    // Xử lý từng proxy từ config
    for (const parsedProxy of parsedProxies) {
      const existingProxy = existingProxyMap.get(parsedProxy.port);
      processedPorts.add(parsedProxy.port);

      // Map protocol string to Protocol enum
      let protocol: Protocol;
      switch (parsedProxy.protocol) {
        case 'SOCKS4':
          protocol = Protocol.SOCKS4;
          break;
        case 'SOCKS5':
          protocol = Protocol.SOCKS5;
          break;
        case 'HTTP':
        default:
          protocol = Protocol.HTTP;
      }

      if (!existingProxy) {
        // Thêm proxy mới
        await prisma.proxy.create({
          data: {
            port: parsedProxy.port,
            protocol,
            username: parsedProxy.username,
            password: parsedProxy.password,
            serverId,
            isActive: true,
            lastChecked: new Date()
          }
        });
        results.added++;
        results.details.added.push(parsedProxy.port);
      } else {
        // Kiểm tra xem có cần update không
        const needsUpdate =
          existingProxy.protocol !== protocol ||
          existingProxy.username !== parsedProxy.username ||
          existingProxy.password !== parsedProxy.password;

        if (needsUpdate) {
          await prisma.proxy.update({
            where: { id: existingProxy.id },
            data: {
              protocol,
              username: parsedProxy.username,
              password: parsedProxy.password,
              lastChecked: new Date()
            }
          });
          results.updated++;
          results.details.updated.push(parsedProxy.port);
        } else {
          results.unchanged++;
          results.details.unchanged.push(parsedProxy.port);
        }
      }
    }

    // Tìm orphaned proxies (trong DB nhưng không trong config)
    for (const existingProxy of existingProxies) {
      if (!processedPorts.has(existingProxy.port)) {
        results.orphaned++;
        results.details.orphaned.push(existingProxy.port);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Đồng bộ hoàn tất: ${results.added} thêm mới, ${results.updated} cập nhật, ${results.unchanged} không đổi, ${results.orphaned} không có trong config`,
      summary: results
    });

  } catch (error) {
    console.error('Sync proxies error:', error);
    return NextResponse.json(
      { error: 'Failed to sync proxies' },
      { status: 500 }
    );
  }
}
