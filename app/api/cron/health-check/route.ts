import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { SSHService } from '@/lib/ssh';
import { ServerStatus } from '@prisma/client';

// Force Node.js runtime - node-ssh requires fs module which is not available in Edge
export const runtime = 'nodejs';

// This route can be called by a cron job to check server and proxy health
// For Next.js, you can use Vercel Cron or call this endpoint from an external scheduler
export const dynamic = 'force-dynamic';

// POST /api/cron/health-check - Run health check for all servers and proxies
export async function POST(request: Request) {
  try {
    // Verify cron secret if provided (optional security)
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      servers: {
        checked: 0,
        online: 0,
        offline: 0,
        errors: 0
      },
      proxies: {
        checked: 0,
        active: 0,
        inactive: 0
      },
      details: [] as any[]
    };

    // Get all servers
    const servers = await prisma.server.findMany({
      include: {
        proxies: true
      }
    });

    for (const server of servers) {
      const serverResult: any = {
        serverId: server.id,
        serverName: server.name,
        host: server.host,
        status: null,
        proxiesChecked: 0,
        proxiesActive: 0,
        error: null
      };

      try {
        // Test SSH connection
        const connectionResult = await SSHService.testConnection(server);
        
        if (connectionResult.success) {
          // Server is online
          serverResult.status = 'ONLINE';
          results.servers.online++;
          
          // Update server status
          await prisma.server.update({
            where: { id: server.id },
            data: {
              status: ServerStatus.ACTIVE,
              lastChecked: new Date()
            }
          });

          // Check all proxies on this server
          for (const proxy of server.proxies) {
            try {
              const isListening = await SSHService.checkProxyPort(server, proxy.port);
              
              await prisma.proxy.update({
                where: { id: proxy.id },
                data: {
                  isActive: isListening,
                  lastChecked: new Date()
                }
              });

              results.proxies.checked++;
              serverResult.proxiesChecked++;
              
              if (isListening) {
                results.proxies.active++;
                serverResult.proxiesActive++;
              } else {
                results.proxies.inactive++;
              }
            } catch (proxyError) {
              console.error(`Failed to check proxy ${proxy.port} on server ${server.id}:`, proxyError);
              results.proxies.checked++;
              results.proxies.inactive++;
            }
          }
        } else {
          // Server is offline
          serverResult.status = 'OFFLINE';
          serverResult.error = connectionResult.error;
          results.servers.offline++;
          
          await prisma.server.update({
            where: { id: server.id },
            data: {
              status: ServerStatus.OFFLINE,
              lastChecked: new Date()
            }
          });

          // Mark all proxies as inactive
          for (const proxy of server.proxies) {
            await prisma.proxy.update({
              where: { id: proxy.id },
              data: {
                isActive: false,
                lastChecked: new Date()
              }
            });
            results.proxies.checked++;
            results.proxies.inactive++;
          }
        }
      } catch (error: any) {
        console.error(`Failed to check server ${server.id}:`, error);
        serverResult.status = 'ERROR';
        serverResult.error = error.message;
        results.servers.errors++;
        
        await prisma.server.update({
          where: { id: server.id },
          data: {
            status: ServerStatus.ERROR,
            lastChecked: new Date()
          }
        });
      }

      results.servers.checked++;
      results.details.push(serverResult);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        servers: results.servers,
        proxies: results.proxies
      },
      details: results.details
    });

  } catch (error) {
    console.error('Health check cron error:', error);
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    );
  }
}

// GET /api/cron/health-check - Get last health check info (optional)
export async function GET() {
  try {
    const servers = await prisma.server.findMany({
      select: {
        id: true,
        name: true,
        host: true,
        status: true,
        lastChecked: true,
        is3ProxyInstalled: true,
        _count: {
          select: {
            proxies: true
          }
        }
      },
      orderBy: {
        lastChecked: 'desc'
      }
    });

    const proxies = await prisma.proxy.findMany({
      select: {
        id: true,
        port: true,
        isActive: true,
        lastChecked: true,
        server: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        lastChecked: 'desc'
      },
      take: 50
    });

    return NextResponse.json({
      servers,
      recentProxies: proxies
    });
  } catch (error) {
    console.error('Get health check status error:', error);
    return NextResponse.json(
      { error: 'Failed to get health check status' },
      { status: 500 }
    );
  }
}
