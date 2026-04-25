import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { SSHService } from '@/lib/ssh';
import { Protocol } from '@prisma/client';

// Force Node.js runtime - node-ssh requires fs module which is not available in Edge
export const runtime = 'nodejs';

// GET /api/admin/servers/[id]/proxies - List proxies on a server
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

    // Check if server exists
    const server = await prisma.server.findUnique({
      where: { id: serverId }
    });

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    // Get all proxies on this server
    const proxies = await prisma.proxy.findMany({
      where: { serverId },
      include: {
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
    });

    return NextResponse.json({ proxies });
  } catch (error) {
    console.error('Get proxies error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proxies' },
      { status: 500 }
    );
  }
}

// POST /api/admin/servers/[id]/proxies - Create new proxy
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

    const { port, protocol, username, password, assignedTo, expiresAt } = await request.json();

    // Validate required fields
    if (!port || !protocol) {
      return NextResponse.json(
        { error: 'Port and protocol are required' },
        { status: 400 }
      );
    }

    // Validate protocol
    if (!Object.values(Protocol).includes(protocol)) {
      return NextResponse.json(
        { error: 'Invalid protocol. Must be HTTP, SOCKS4, or SOCKS5' },
        { status: 400 }
      );
    }

    // Check if server exists
    const server = await prisma.server.findUnique({
      where: { id: serverId }
    });

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    // Check if port is within server's port range
    if (port < server.proxyPortStart || port > server.proxyPortEnd) {
      return NextResponse.json(
        { error: `Port must be between ${server.proxyPortStart} and ${server.proxyPortEnd}` },
        { status: 400 }
      );
    }

    // Check if port is already in use
    const existingProxy = await prisma.proxy.findUnique({
      where: {
        serverId_port: {
          serverId,
          port
        }
      }
    });

    if (existingProxy) {
      return NextResponse.json(
        { error: 'Port is already in use on this server' },
        { status: 409 }
      );
    }

    // If assigned to customer, check if customer exists
    if (assignedTo) {
      const customer = await prisma.user.findUnique({
        where: { id: assignedTo }
      });

      if (!customer || customer.role !== 'CUSTOMER') {
        return NextResponse.json(
          { error: 'Invalid customer' },
          { status: 400 }
        );
      }
    }

    // Create proxy in database
    const proxy = await prisma.proxy.create({
      data: {
        serverId,
        port,
        protocol,
        username: username || null,
        password: password || null,
        assignedTo: assignedTo || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: true
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            name: true
          }
        },
        server: {
          select: {
            id: true,
            name: true,
            host: true
          }
        }
      }
    });

    // Create proxy on server via SSH
    try {
      const proxyConfig = {
        port,
        protocol,
        username: username || undefined,
        password: password || undefined
      };

      const result = await SSHService.createProxy(server, proxyConfig);

      if (!result.success) {
        // If SSH creation failed, delete proxy from database
        await prisma.proxy.delete({
          where: { id: proxy.id }
        });

        return NextResponse.json(
          { error: `Failed to create proxy on server: ${result.message}` },
          { status: 500 }
        );
      }
    } catch (sshError) {
      console.error('SSH proxy creation failed:', sshError);
      
      // Delete proxy from database if SSH failed
      await prisma.proxy.delete({
        where: { id: proxy.id }
      });

      return NextResponse.json(
        { error: 'Failed to create proxy on server' },
        { status: 500 }
      );
    }

    return NextResponse.json({ proxy }, { status: 201 });
  } catch (error) {
    console.error('Create proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to create proxy' },
      { status: 500 }
    );
  }
}
