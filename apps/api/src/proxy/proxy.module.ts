import { Module } from '@nestjs/common';
import { ProxyService } from './proxy.service';
import { ProxyController } from './proxy.controller';
import { EventModule } from '../event/event.module';
import { AllocatorModule } from '../allocator/allocator.module';

@Module({
  imports: [EventModule, AllocatorModule],
  providers: [ProxyService],
  controllers: [ProxyController],
  exports: [ProxyService],
})
export class ProxyModule {}
