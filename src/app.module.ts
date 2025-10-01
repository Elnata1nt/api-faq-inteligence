import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { IaFaqModule } from './ia-faq/ia-faq.module';
import { RagModule } from './raq/raq.module';

@Module({
  imports: [IaFaqModule, RagModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
