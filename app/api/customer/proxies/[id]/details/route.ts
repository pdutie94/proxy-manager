import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

// GET /api/customer/proxies/[id]/details - Get detailed proxy information
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Verify customer access
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyAccessToken(token);
    if (payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const proxyId = parseInt(id);
    if (isNaN(proxyId)) {
      return NextResponse.json({ error: 'Invalid proxy ID' }, { status: 400 });
    }

    // Get proxy details with validation that it belongs to current user
    const proxy = await prisma.proxy.findUnique({
      where: { id: proxyId },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            host: true,
            sshPort: true
          }
        }
      }
    });

    if (!proxy) {
      return NextResponse.json({ error: 'Proxy not found' }, { status: 404 });
    }

    // Verify proxy belongs to current user
    if (proxy.assignedTo !== payload.sub) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if proxy is active and not expired
    const isExpired = proxy.expiresAt ? new Date(proxy.expiresAt) <= new Date() : false;
    
    if (!proxy.isActive || isExpired) {
      return NextResponse.json({ 
        error: 'Proxy is not active or has expired',
        isActive: proxy.isActive,
        isExpired,
        expiresAt: proxy.expiresAt
      }, { status: 403 });
    }

    // Generate connection strings for different protocols
    const connectionStrings = {
      direct: `${proxy.protocol.toLowerCase()}://${proxy.username ? `${proxy.username}:${proxy.password}@` : ''}${proxy.server.host}:${proxy.port}`,
      browser: `${proxy.protocol.toLowerCase()}://${proxy.server.host}:${proxy.port}`,
      withAuth: proxy.username ? `${proxy.protocol.toLowerCase()}://${proxy.username}:${proxy.password}@${proxy.server.host}:${proxy.port}` : null
    };

    // Format response with comprehensive proxy information
    const proxyDetails = {
      id: proxy.id,
      port: proxy.port,
      protocol: proxy.protocol,
      username: proxy.username,
      password: proxy.password,
      isActive: proxy.isActive,
      isExpired,
      expiresAt: proxy.expiresAt,
      createdAt: proxy.createdAt,
      updatedAt: proxy.updatedAt,
      lastChecked: proxy.lastChecked,
      connectionStrings,
      server: {
        id: proxy.server.id,
        name: proxy.server.name,
        host: proxy.server.host,
        sshPort: proxy.server.sshPort
      },
      usage: {
        recommendedFor: proxy.protocol === 'HTTP' ? 'web browsing, scraping' : 'general purpose, torrenting',
        authentication: proxy.username ? 'required' : 'none',
        encryption: proxy.protocol === 'SOCKS5' ? 'supports encryption' : 'no encryption'
      }
    };

    return NextResponse.json({ proxy: proxyDetails });
  } catch (error) {
    console.error('Get proxy details error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proxy details' },
      { status: 500 }
    );
  }
}
