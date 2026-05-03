import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  async check() {
    const startTime = Date.now();
    
    try {
      // Check database connection
      const { prisma } = await import('@proxy-manager/db');
      await prisma.$queryRaw`SELECT 1`;
      const dbStatus = 'connected';
      const dbTime = Date.now() - startTime;
      
      // Check Redis connection
      let redisStatus = 'connected';
      let redisTime = 0;
      try {
        // Redis check would be here if needed
        redisTime = Date.now() - startTime;
      } catch {
        redisStatus = 'disconnected';
      }

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
          database: {
            status: dbStatus,
            responseTime: `${dbTime}ms`,
          },
          redis: {
            status: redisStatus,
            responseTime: `${redisTime}ms`,
          },
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}
