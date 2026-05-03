import { Module } from '@nestjs/common';
import { AllocatorService } from './allocator.service';

@Module({
  providers: [AllocatorService],
  exports: [AllocatorService],
})
export class AllocatorModule {}
