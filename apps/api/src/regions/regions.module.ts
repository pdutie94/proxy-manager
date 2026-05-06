import { Module } from '@nestjs/common';
import { RegionsController } from './regions.controller';
import { DatabaseModule } from '@proxy-manager/db';

@Module({
  imports: [DatabaseModule],
  controllers: [RegionsController],
})
export class RegionsModule {}
