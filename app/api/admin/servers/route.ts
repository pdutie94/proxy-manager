import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

// GET /api/admin/servers - List all servers
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

    const servers = await prisma.server.findMany({
      include: {
        proxies: {
          select: {
            id: true,
            port: true,
            protocol: true,
            isActive: true,
            assignedTo: true,
            expiresAt: true,
          }
        },
        _count: {
          select: {
            proxies: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ servers });
  } catch (error) {
    console.error('Get servers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch servers' },
      { status: 500 }
    );
  }
}

// POST /api/admin/servers - Create new server
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

    const {
      name,
      host,
      sshPort = 22,
      sshUsername,
      sshPassword,
      sshPrivateKey,
      sshKeyPassphrase,
      proxyPortStart = 10000,
      proxyPortEnd = 20000
    } = await request.json();

    // Validate required fields
    if (!name || !host || !sshUsername) {
      return NextResponse.json(
        { error: 'Name, host, and SSH username are required' },
        { status: 400 }
      );
    }

    // Validate authentication method
    if (!sshPassword && !sshPrivateKey) {
      return NextResponse.json(
        { error: 'Either SSH password or private key is required' },
        { status: 400 }
      );
    }

    // Check if server name already exists
    const existingServer = await prisma.server.findFirst({
      where: { name }
    });

    if (existingServer) {
      return NextResponse.json(
        { error: 'Server with this name already exists' },
        { status: 409 }
      );
    }

    // Create new server
    const server = await prisma.server.create({
      data: {
        name,
        host,
        sshPort,
        sshUsername,
        sshPassword: sshPassword || null,
        sshPrivateKey: sshPrivateKey || null,
        sshKeyPassphrase: sshKeyPassphrase || null,
        proxyPortStart,
        proxyPortEnd,
        status: 'PENDING'
      },
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

    return NextResponse.json({ server }, { status: 201 });
  } catch (error) {
    console.error('Create server error:', error);
    return NextResponse.json(
      { error: 'Failed to create server' },
      { status: 500 }
    );
  }
}
