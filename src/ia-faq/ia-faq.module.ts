import { Module } from '@nestjs/common';
import { IaFaqService } from './ia-faq.service';
import { IaFaqController } from './ia-faq.controller';

@Module({
  controllers: [IaFaqController],
  providers: [IaFaqService],
})
export class IaFaqModule {}
