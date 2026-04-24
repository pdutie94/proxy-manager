import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';

// POST /api/admin/servers/[id]/proxies/assign - Assign proxy to customer
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

    const { proxyId, customerId, expiresAt, username, password } = await request.json();

    // Validate required fields
    if (!proxyId || !customerId) {
      return NextResponse.json(
        { error: 'Proxy ID and Customer ID are required' },
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

    // Check if proxy exists and belongs to this server
    const proxy = await prisma.proxy.findFirst({
      where: {
        id: proxyId,
        serverId: serverId
      }
    });

    if (!proxy) {
      return NextResponse.json({ error: 'Proxy not found on this server' }, { status: 404 });
    }

    // Check if proxy is already assigned
    if (proxy.assignedTo) {
      return NextResponse.json(
        { error: 'Proxy is already assigned to a customer' },
        { status: 409 }
      );
    }

    // Check if customer exists
    const customer = await prisma.user.findUnique({
      where: { id: customerId }
    });

    if (!customer || customer.role !== 'CUSTOMER') {
      return NextResponse.json(
        { error: 'Invalid customer' },
        { status: 400 }
      );
    }

    // Parse expiry date if provided
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

    // Update proxy with assignment
    const updatedProxy = await prisma.proxy.update({
      where: { id: proxyId },
      data: {
        assignedTo: customerId,
        expiresAt: expiryDate,
        username: username || null,
        password: password || null,
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

    return NextResponse.json({ 
      message: 'Proxy assigned successfully',
      proxy: updatedProxy
    });
  } catch (error) {
    console.error('Assign proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to assign proxy' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/servers/[id]/proxies/assign - Update proxy assignment
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

    const { proxyId, expiresAt, username, password, isActive } = await request.json();

    if (!proxyId) {
      return NextResponse.json(
        { error: 'Proxy ID is required' },
        { status: 400 }
      );
    }

    // Check if proxy exists and belongs to this server
    const proxy = await prisma.proxy.findFirst({
      where: {
        id: proxyId,
        serverId: serverId
      }
    });

    if (!proxy) {
      return NextResponse.json({ error: 'Proxy not found on this server' }, { status: 404 });
    }

    // Parse expiry date if provided
    let expiryDate = undefined;
    if (expiresAt !== undefined) {
      if (expiresAt === null) {
        expiryDate = null;
      } else {
        expiryDate = new Date(expiresAt);
        if (isNaN(expiryDate.getTime())) {
          return NextResponse.json(
            { error: 'Invalid expiry date format' },
            { status: 400 }
          );
        }
      }
    }

    // Update proxy assignment
    const updatedProxy = await prisma.proxy.update({
      where: { id: proxyId },
      data: {
        expiresAt: expiryDate,
        username: username !== undefined ? username : undefined,
        password: password !== undefined ? password : undefined,
        isActive: isActive !== undefined ? isActive : undefined
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

    return NextResponse.json({ 
      message: 'Proxy assignment updated successfully',
      proxy: updatedProxy
    });
  } catch (error) {
    console.error('Update proxy assignment error:', error);
    return NextResponse.json(
      { error: 'Failed to update proxy assignment' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/servers/[id]/proxies/assign - Unassign proxy
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

    const { proxyId } = await request.json();

    if (!proxyId) {
      return NextResponse.json(
        { error: 'Proxy ID is required' },
        { status: 400 }
      );
    }

    // Check if proxy exists and belongs to this server
    const proxy = await prisma.proxy.findFirst({
      where: {
        id: proxyId,
        serverId: serverId
      }
    });

    if (!proxy) {
      return NextResponse.json({ error: 'Proxy not found on this server' }, { status: 404 });
    }

    // Unassign proxy
    const updatedProxy = await prisma.proxy.update({
      where: { id: proxyId },
      data: {
        assignedTo: null,
        expiresAt: null,
        username: null,
        password: null,
        isActive: false
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
      message: 'Proxy unassigned successfully',
      proxy: updatedProxy
    });
  } catch (error) {
    console.error('Unassign proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to unassign proxy' },
      { status: 500 }
    );
  }
}
