import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@proxy-manager/db';
import { ProxyModule } from './proxy/proxy.module';
import { AllocatorModule } from './allocator/allocator.module';
import { EventModule } from './event/event.module';
import { NodeModule } from './node/node.module';
import { NodesModule } from './nodes/nodes.module';
import { CronModule } from './cron/cron.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RegionsModule } from './regions/regions.module';

@Module({
  imports: [
    DatabaseModule,
    ScheduleModule.forRoot(),
    RedisModule,
    ProxyModule,
    AllocatorModule,
    EventModule,
    NodeModule,
    NodesModule,
    CronModule,
    HealthModule,
    DashboardModule,
    RegionsModule,
  ],
})
export class AppModule {}
