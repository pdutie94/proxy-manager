import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DatabaseModule } from '@proxy-manager/db';

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardController],
})
export class DashboardModule {}
