import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/customer/available-proxies - List available proxies for rent
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

    // Get all available proxies (not assigned to any customer)
    const proxies = await prisma.proxy.findMany({
      where: {
        assignedTo: null,
        isActive: true
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
        port: 'asc'
      }
    });

    return NextResponse.json({ 
      proxies,
      total: proxies.length
    });
  } catch (error) {
    console.error('Get available proxies error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available proxies' },
      { status: 500 }
    );
  }
}
