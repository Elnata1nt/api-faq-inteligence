import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { IaMessageService } from './ia-faq.service';

@Controller('api/chat')
export class IaMessageController {
  constructor(private readonly iaMessageService: IaMessageService) {}

  @Post()
  async chat(@Body() body: { message: string; sessionId?: string }) {
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

  @Get('sessions')
  async listSessions() {
    const sessions = await this.iaMessageService.getAllSessions();
    return { ok: true, sessions };
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    const session = await this.iaMessageService.getSession(id);
    if (!session) {
      throw new NotFoundException('Sessão não encontrada');
    }
    return { ok: true, session };
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string) {
    try {
      const result = await this.iaMessageService.deleteSession(id);
      return result;
    } catch {
      throw new NotFoundException('Sessão não encontrada');
    }
  }
}
