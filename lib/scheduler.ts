import cron from 'node-cron';
import { prisma } from './db';
import { SSHService } from './ssh';
import { ServerStatus } from '@prisma/client';

/**
 * Health check scheduler - runs every hour to check server and proxy health
 * Cron expression: 0 * * * * = At minute 0 of every hour
 */

let healthCheckTask: cron.ScheduledTask | null = null;

/**
 * Run health check for all servers and their proxies
 */
async function runHealthCheck() {
  console.log('[Scheduler] Running health check at', new Date().toISOString());

  try {
    const servers = await prisma.server.findMany({
      include: {
        proxies: true
      }
    });

    for (const server of servers) {
      try {
        // Test SSH connection
        const connectionResult = await SSHService.testConnection(server);

        if (connectionResult.success) {
          // Server is online
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
            } catch (proxyError) {
              console.error(`[Scheduler] Failed to check proxy ${proxy.port} on server ${server.id}:`, proxyError);
              // Mark proxy as inactive
              await prisma.proxy.update({
                where: { id: proxy.id },
                data: {
                  isActive: false,
                  lastChecked: new Date()
                }
              });
            }
          }
        } else {
          // Server is offline
          console.log(`[Scheduler] Server ${server.id} (${server.host}) is offline`);
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
          }
        }
      } catch (error) {
        console.error(`[Scheduler] Failed to check server ${server.id}:`, error);
        await prisma.server.update({
          where: { id: server.id },
          data: {
            status: ServerStatus.ERROR,
            lastChecked: new Date()
          }
        });
      }
    }

    console.log('[Scheduler] Health check completed at', new Date().toISOString());
  } catch (error) {
    console.error('[Scheduler] Health check failed:', error);
  }
}

/**
 * Start the health check scheduler
 * Runs every hour at minute 0
 */
export function startHealthCheckScheduler() {
  if (healthCheckTask) {
    console.log('[Scheduler] Health check scheduler already running');
    return;
  }

  console.log('[Scheduler] Starting health check scheduler (runs every hour)');

  // Run every hour at minute 0: 0 * * * *
  healthCheckTask = cron.schedule('0 * * * *', runHealthCheck, {
    scheduled: true,
    timezone: 'Asia/Ho_Chi_Minh' // Use Vietnam timezone
  });

  console.log('[Scheduler] Health check scheduler started');
}

/**
 * Stop the health check scheduler
 */
export function stopHealthCheckScheduler() {
  if (healthCheckTask) {
    healthCheckTask.stop();
    healthCheckTask = null;
    console.log('[Scheduler] Health check scheduler stopped');
  }
}

/**
 * Run health check immediately (for manual trigger)
 */
export async function runHealthCheckNow() {
  console.log('[Scheduler] Manual health check triggered');
  await runHealthCheck();
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return healthCheckTask !== null;
}
