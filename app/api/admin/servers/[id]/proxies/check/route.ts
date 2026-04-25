import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { SSHService } from '@/lib/ssh';

// Force Node.js runtime - node-ssh requires fs module which is not available in Edge
export const runtime = 'nodejs';

// POST /api/admin/servers/[id]/proxies/check - Check all proxies on server
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
      where: { id: serverId },
      include: {
        proxies: true
      }
    });

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    // Check if server is connected
    if (server.status !== 'ACTIVE') {
      return NextResponse.json({
        error: 'Server is not connected. Please connect to server first.',
        serverStatus: server.status
      }, { status: 400 });
    }

    // Test SSH connection first
    const connectionResult = await SSHService.testConnection(server);
    if (!connectionResult.success) {
      return NextResponse.json({
        error: 'Cannot connect to server via SSH',
        details: connectionResult.error
      }, { status: 500 });
    }

    // Check each proxy
    const results = [];
    for (const proxy of server.proxies) {
      const isListening = await SSHService.checkProxyPort(server, proxy.port);
      
      // Update proxy status
      await prisma.proxy.update({
        where: { id: proxy.id },
        data: {
          isActive: isListening,
          lastChecked: new Date()
        }
      });

      results.push({
        id: proxy.id,
        port: proxy.port,
        protocol: proxy.protocol,
        isActive: isListening,
        lastChecked: new Date().toISOString()
      });
    }

    // Update server last checked time
    await prisma.server.update({
      where: { id: serverId },
      data: {
        lastChecked: new Date()
      }
    });

    const activeCount = results.filter(r => r.isActive).length;
    const totalCount = results.length;

    return NextResponse.json({
      success: true,
      message: `Checked ${totalCount} proxies. ${activeCount} active, ${totalCount - activeCount} inactive.`,
      server: {
        id: server.id,
        name: server.name,
        host: server.host
      },
      results,
      summary: {
        total: totalCount,
        active: activeCount,
        inactive: totalCount - activeCount
      }
    });

  } catch (error) {
    console.error('Check proxies error:', error);
    return NextResponse.json(
      { error: 'Failed to check proxies' },
      { status: 500 }
    );
  }
}
