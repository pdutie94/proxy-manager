import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

// POST /api/customer/proxies/[id]/extend - Extend proxy rental duration
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const proxyId = parseInt(params.id);
    if (isNaN(proxyId)) {
      return NextResponse.json({ error: 'Invalid proxy ID' }, { status: 400 });
    }

    const { additionalDays } = await request.json();

    if (!additionalDays || additionalDays < 1) {
      return NextResponse.json(
        { error: 'Additional days must be at least 1' },
        { status: 400 }
      );
    }

    // Check if proxy exists and belongs to this customer
    const proxy = await prisma.proxy.findFirst({
      where: {
        id: proxyId,
        assignedTo: payload.sub
      }
    });

    if (!proxy) {
      return NextResponse.json(
        { error: 'Proxy not found or not assigned to you' },
        { status: 404 }
      );
    }

    // Calculate new expiry date
    const currentDate = new Date();
    const currentExpiry = proxy.expiresAt ? new Date(proxy.expiresAt) : currentDate;
    
    // If already expired, start from today; otherwise extend from current expiry
    const baseDate = currentExpiry < currentDate ? currentDate : currentExpiry;
    const newExpiryDate = new Date(baseDate);
    newExpiryDate.setDate(newExpiryDate.getDate() + additionalDays);

    // Update proxy expiry
    const updatedProxy = await prisma.proxy.update({
      where: { id: proxyId },
      data: {
        expiresAt: newExpiryDate,
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
      message: 'Proxy rental extended successfully',
      proxy: updatedProxy,
      newExpiryDate: newExpiryDate.toISOString()
    });
  } catch (error) {
    console.error('Extend proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to extend proxy rental' },
      { status: 500 }
    );
  }
}
