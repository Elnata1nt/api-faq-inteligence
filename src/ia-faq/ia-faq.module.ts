import { Module } from '@nestjs/common';
import { IaMessageService } from './ia-faq.service';
import { IaMessageController } from './ia-faq.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [IaMessageController],
  providers: [IaMessageService],
})
export class IaFaqModule {}
