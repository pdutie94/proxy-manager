import { Module, Global } from '@nestjs/common';
import Redis from 'ioredis';
import { IRedisService, RedisService, MockRedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_SERVICE',
      useFactory: () => {
        // Production: Use real Redis
        if (process.env.REDIS_URL || process.env.NODE_ENV === 'production') {
          const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
          console.log('🟢 Using Real Redis:', process.env.REDIS_URL || 'redis://localhost:6379');
          return new RedisService(redis);
        }
        
        // Development: Use Mock Redis
        console.log('🔴 Using Mock Redis (development mode)');
        return new MockRedisService();
      },
    },
  ],
  exports: ['REDIS_SERVICE'],
})
export class RedisModule {}
