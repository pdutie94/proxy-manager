import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ProxyModule } from './proxy/proxy.module';
import { AllocatorModule } from './allocator/allocator.module';
import { EventModule } from './event/event.module';
import { NodeModule } from './node/node.module';
import { CronModule } from './cron/cron.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    RedisModule,
    ProxyModule,
    AllocatorModule,
    EventModule,
    NodeModule,
    CronModule,
    HealthModule,
  ],
})
export class AppModule {}
