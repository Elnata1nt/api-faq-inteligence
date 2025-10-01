import { Module } from '@nestjs/common';
import { RagController } from './raq.controller';
import { RagService } from './raq.service';

@Module({
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
