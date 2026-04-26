import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { SSHService } from '@/lib/ssh';

// Force Node.js runtime - node-ssh requires fs module which is not available in Edge
export const runtime = 'nodejs';

// DELETE /api/admin/servers/[id]/proxies/[port] - Delete proxy
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; port: string }> }
) {
  try {
    const { id, port } = await params;
    // Verify admin access
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const serverId = parseInt(id);
    const portNum = parseInt(port);

    if (isNaN(serverId) || isNaN(portNum)) {
      return NextResponse.json({ error: 'Invalid server ID or port' }, { status: 400 });
    }

    // Check if server exists
    const server = await prisma.server.findUnique({
      where: { id: serverId }
    });

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    // Find the proxy
    const proxy = await prisma.proxy.findUnique({
      where: {
        serverId_port: {
          serverId,
          port: portNum
        }
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!proxy) {
      return NextResponse.json({ error: 'Proxy not found' }, { status: 404 });
    }

    // Delete proxy from server via SSH
    try {
      const result = await SSHService.deleteProxy(server, portNum);

      if (!result.success) {
        console.error('Failed to delete proxy from server:', result.error);
        // Continue with database deletion even if SSH fails
      }
    } catch (sshError) {
      console.error('SSH proxy deletion failed:', sshError);
      // Continue with database deletion even if SSH fails
    }

    // Delete proxy from database
    await prisma.proxy.delete({
      where: { id: proxy.id }
    });

    return NextResponse.json({ 
      message: 'Proxy deleted successfully',
      proxy: {
        id: proxy.id,
        port: proxy.port,
        protocol: proxy.protocol,
        customer: proxy.customer
      }
    });
  } catch (error) {
    console.error('Delete proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to delete proxy' },
      { status: 500 }
    );
  }
}
