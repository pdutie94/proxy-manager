import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAccessToken } from '@/lib/auth';
import { SSHService } from '@/lib/ssh';
import { ServerStatus } from '@prisma/client';

// Force Node.js runtime - node-ssh requires fs module which is not available in Edge
export const runtime = 'nodejs';

// POST /api/admin/servers/[id]/connect - Connect to server and install 3proxy if needed
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

    // Step 1: Test SSH connection
    const connectionResult = await SSHService.testConnection(server);
    
    if (!connectionResult.success) {
      // Update server status to OFFLINE
      await prisma.server.update({
        where: { id: serverId },
        data: {
          status: ServerStatus.OFFLINE,
          lastChecked: new Date()
        }
      });

      return NextResponse.json({
        success: false,
        step: 'connection',
        message: 'Không thể kết nối SSH đến server',
        error: connectionResult.error
      }, { status: 400 });
    }

    // Step 2: Check if 3proxy is installed
    let is3ProxyInstalled = await SSHService.check3ProxyInstalled(server);
    let installMessage = '';

    // Step 3: Install 3proxy if not installed
    if (!is3ProxyInstalled) {
      const installResult = await SSHService.install3Proxy(server);
      
      if (!installResult.success) {
        // Update server status to ERROR
        await prisma.server.update({
          where: { id: serverId },
          data: {
            status: ServerStatus.ERROR,
            lastChecked: new Date()
          }
        });

        return NextResponse.json({
          success: false,
          step: 'install',
          message: 'Cài đặt 3proxy thất bại',
          error: installResult.error
        }, { status: 500 });
      }

      is3ProxyInstalled = true;
      installMessage = '3proxy đã được cài đặt thành công';
    } else {
      installMessage = '3proxy đã được cài đặt từ trước';
    }

    // Step 4: Update server status to ACTIVE
    await prisma.server.update({
      where: { id: serverId },
      data: {
        status: ServerStatus.ACTIVE,
        is3ProxyInstalled: true,
        lastChecked: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      step: 'complete',
      message: `Kết nối thành công. ${installMessage}`,
      is3ProxyInstalled: true,
      status: ServerStatus.ACTIVE
    });

  } catch (error) {
    console.error('Connect server error:', error);
    
    // Try to update server status to ERROR
    try {
      const serverId = parseInt(params.id);
      await prisma.server.update({
        where: { id: serverId },
        data: {
          status: ServerStatus.ERROR,
          lastChecked: new Date()
        }
      });
    } catch (updateError) {
      console.error('Failed to update server status:', updateError);
    }

    return NextResponse.json(
      { error: 'Failed to connect to server' },
      { status: 500 }
    );
  }
}
