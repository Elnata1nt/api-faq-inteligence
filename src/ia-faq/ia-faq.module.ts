import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IaMessageService } from './ia-faq.service';
import { IaMessageController } from './ia-faq.controller';
import { RagModule } from 'src/raq/rag.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), RagModule],
  controllers: [IaMessageController],
  providers: [IaMessageService],
})
export class IaFaqModule {}
