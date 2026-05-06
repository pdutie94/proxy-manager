import { Module } from '@nestjs/common';
import { NodesController } from './nodes.controller';
import { SshService } from './ssh.service';
import { DatabaseModule } from '@proxy-manager/db';
import { NodeModule } from '../node/node.module';
import { EventModule } from '../event/event.module';

@Module({
  imports: [DatabaseModule, NodeModule, EventModule],
  controllers: [NodesController],
  providers: [SshService],
})
export class NodesModule {}
