import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { SSHService } from '@/lib/ssh';
import { ServerStatus } from '@prisma/client';

// POST /api/admin/servers/[id]/install - Install 3proxy on server
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

    // Get server details
    const server = await prisma.server.findUnique({
      where: { id: serverId }
    });

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    // Update server status to INSTALLING
    await prisma.server.update({
      where: { id: serverId },
      data: {
        status: ServerStatus.INSTALLING
      }
    });

    // Install 3proxy
    const result = await SSHService.install3Proxy(server);

    // Update server status based on installation result
    const finalStatus = result.success ? ServerStatus.ACTIVE : ServerStatus.ERROR;
    await prisma.server.update({
      where: { id: serverId },
      data: {
        status: finalStatus
      }
    });

    return NextResponse.json({
      success: result.success,
      message: result.message,
      error: result.error,
      status: finalStatus
    });
  } catch (error) {
    console.error('Install 3proxy error:', error);
    
    // Update server status to ERROR on failure
    try {
      const serverId = parseInt(params.id);
      await prisma.server.update({
        where: { id: serverId },
        data: {
          status: ServerStatus.ERROR
        }
      });
    } catch (updateError) {
      console.error('Failed to update server status:', updateError);
    }

    return NextResponse.json(
      { error: 'Failed to install 3proxy' },
      { status: 500 }
    );
  }
}
