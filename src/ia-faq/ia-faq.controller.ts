import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { CreateIaFaqDto } from './dto/create-ia-faq.dto';
import { IaMessageService } from './ia-faq.service';

@Controller('api/chat')
export class IaMessageController {
  constructor(private readonly iaMessageService: IaMessageService) {}

  @Post()
  async chat(@Body() body: CreateIaFaqDto) {
    const { message, sessionId } = body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      throw new BadRequestException('Message is required and must be a string');
    }

    const { response, sessionId: returnedSessionId } =
      await this.iaMessageService.getChatCompletion(message, sessionId);

    return {
      response,
      sessionId: returnedSessionId,
    };
  }
}
