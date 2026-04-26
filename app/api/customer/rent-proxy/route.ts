import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

// POST /api/customer/rent-proxy - Rent a proxy
export async function POST(request: NextRequest) {
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

    const { proxyId, expiresAt } = await request.json();

    // Validate required fields
    if (!proxyId) {
      return NextResponse.json(
        { error: 'Proxy ID is required' },
        { status: 400 }
      );
    }

    // Check if proxy exists and is available
    const proxy = await prisma.proxy.findFirst({
      where: {
        id: proxyId,
        assignedTo: null,
        isActive: true
      }
    });

    if (!proxy) {
      return NextResponse.json(
        { error: 'Proxy not found or already assigned' },
        { status: 404 }
      );
    }

    // Parse expiry date
    let expiryDate = null;
    if (expiresAt) {
      expiryDate = new Date(expiresAt);
      if (isNaN(expiryDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid expiry date format' },
          { status: 400 }
        );
      }
    }

    // Assign proxy to customer
    const updatedProxy = await prisma.proxy.update({
      where: { id: proxyId },
      data: {
        assignedTo: payload.sub,
        expiresAt: expiryDate,
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
      }
    });

    return NextResponse.json({ 
      message: 'Proxy rented successfully',
      proxy: updatedProxy
    });
  } catch (error) {
    console.error('Rent proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to rent proxy' },
      { status: 500 }
    );
  }
}
