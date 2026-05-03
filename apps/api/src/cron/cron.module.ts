import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { EventModule } from '../event/event.module';
import { NodeModule } from '../node/node.module';

@Module({
  imports: [EventModule, NodeModule],
  providers: [CronService],
})
export class CronModule {}
