import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { SSHService } from '@/lib/ssh';

// Force Node.js runtime - node-ssh requires fs module which is not available in Edge
export const runtime = 'nodejs';

// GET /api/admin/servers/[id] - Get server details
export async function GET(
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

    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: {
        proxies: {
          select: {
            id: true,
            port: true,
            protocol: true,
            username: true,
            isActive: true,
            assignedTo: true,
            expiresAt: true,
            createdAt: true,
            customer: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          },
          orderBy: {
            port: 'asc'
          }
        },
        _count: {
          select: {
            proxies: true
          }
        }
      }
    });

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    // Don't return sensitive data
    const { sshPassword, sshPrivateKey, ...safeServer } = server;

    return NextResponse.json({ server: safeServer });
  } catch (error) {
    console.error('Get server error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch server' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/servers/[id] - Update server
export async function PUT(
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

    const {
      name,
      host,
      sshPort,
      sshUsername,
      sshPassword,
      sshPrivateKey,
      sshKeyPassphrase,
      proxyPortStart,
      proxyPortEnd,
      status
    } = await request.json();

    // Check if server exists
    const existingServer = await prisma.server.findUnique({
      where: { id: serverId }
    });

    if (!existingServer) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    // Check if name is being changed and if it's already taken
    if (name && name !== existingServer.name) {
      const nameTaken = await prisma.server.findFirst({
        where: { name }
      });

      if (nameTaken) {
        return NextResponse.json(
          { error: 'Server name already in use' },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (host !== undefined) updateData.host = host;
    if (sshPort !== undefined) updateData.sshPort = sshPort;
    if (sshUsername !== undefined) updateData.sshUsername = sshUsername;
    if (sshPassword !== undefined) updateData.sshPassword = sshPassword || null;
    if (sshPrivateKey !== undefined) updateData.sshPrivateKey = sshPrivateKey || null;
    if (sshKeyPassphrase !== undefined) updateData.sshKeyPassphrase = sshKeyPassphrase || null;
    if (proxyPortStart !== undefined) updateData.proxyPortStart = proxyPortStart;
    if (proxyPortEnd !== undefined) updateData.proxyPortEnd = proxyPortEnd;
    if (status !== undefined) updateData.status = status;

    const updatedServer = await prisma.server.update({
      where: { id: serverId },
      data: updateData,
      select: {
        id: true,
        name: true,
        host: true,
        sshPort: true,
        sshUsername: true,
        proxyPortStart: true,
        proxyPortEnd: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            proxies: true
          }
        }
      }
    });

    return NextResponse.json({ server: updatedServer });
  } catch (error) {
    console.error('Update server error:', error);
    return NextResponse.json(
      { error: 'Failed to update server' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/servers/[id] - Delete server
export async function DELETE(
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

    // Check if server exists
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: {
        _count: {
          select: {
            proxies: true
          }
        }
      }
    });

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    // Don't allow deletion if server has active proxies
    if (server._count.proxies > 0) {
      return NextResponse.json(
        { error: 'Cannot delete server with existing proxies. Delete all proxies first.' },
        { status: 400 }
      );
    }

    // Delete server (cascades will handle related records)
    await prisma.server.delete({
      where: { id: serverId }
    });

    // Close SSH connection if exists
    await SSHService.disconnect(serverId);

    return NextResponse.json({ message: 'Server deleted successfully' });
  } catch (error) {
    console.error('Delete server error:', error);
    return NextResponse.json(
      { error: 'Failed to delete server' },
      { status: 500 }
    );
  }
}
