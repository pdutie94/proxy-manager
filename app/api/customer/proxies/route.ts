import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/customer/proxies - List assigned proxies for current user
export async function GET(request: NextRequest) {
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

    // Get all proxies assigned to this customer (including expired)
    const proxies = await prisma.proxy.findMany({
      where: {
        assignedTo: payload.sub
      },
      include: {
        server: {
          select: {
            id: true,
            name: true,
            host: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format response with connection strings
    const formattedProxies = proxies.map(proxy => {
      const connectionString = `${proxy.protocol.toLowerCase()}://${proxy.username ? `${proxy.username}:${proxy.password}@` : ''}${proxy.server.host}:${proxy.port}`;
      
      return {
        id: proxy.id,
        port: proxy.port,
        protocol: proxy.protocol,
        username: proxy.username,
        password: proxy.password,
        connectionString,
        isActive: proxy.isActive,
        expiresAt: proxy.expiresAt,
        createdAt: proxy.createdAt,
        server: {
          id: proxy.server.id,
          name: proxy.server.name,
          host: proxy.server.host
        },
        isExpired: proxy.expiresAt ? new Date(proxy.expiresAt) <= new Date() : false
      };
    });

    return NextResponse.json({ 
      proxies: formattedProxies,
      total: formattedProxies.length
    });
  } catch (error) {
    console.error('Get customer proxies error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proxies' },
      { status: 500 }
    );
  }
}
