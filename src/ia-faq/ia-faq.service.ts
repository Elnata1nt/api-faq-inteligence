import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

interface Choice {
  message: {
    content: string;
  };
}

interface GroqResponse {
  choices: Choice[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

interface GroqMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable()
export class IaMessageService {
  private groq: Groq;
  private conversationHistory: Map<string, Message[]> = new Map();

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');

    if (!apiKey) {
      throw new InternalServerErrorException(
        'A chave da API da Groq não foi fornecida.',
      );
    }

    this.groq = new Groq({ apiKey });
  }

  private async generateUuid(): Promise<string> {
    const { v4: uuidv4 } = await import('uuid');
    return uuidv4();
  }

  async getChatCompletion(
    message: string,
    sessionId?: string,
  ): Promise<{ response: string; sessionId: string }> {
    try {
      if (!sessionId) {
        sessionId = await this.generateUuid();
      }

      const history = this.conversationHistory.get(sessionId) || [];

      history.push({
        role: 'user',
        content: message,
        createdAt: new Date(),
      });

      const recentHistory = history
        .slice(-20)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const systemMessage: GroqMessage = {
        role: 'system',
        content: `
Você é uma IA desenvolvida pela Holodeck Hub, fundada por Elnata Correa. 
Seu objetivo é proporcionar a melhor experiência e ajudar a resolver os problemas do usuário.
Foque apenas na pergunta atual, usando o histórico somente quando necessário para dar contexto.
Não responda múltiplas perguntas ao mesmo tempo.
Não misture respostas de perguntas diferentes.
Se a pergunta for sobre o histórico, responda somente com base no que está no histórico.`,
      };

      const messagesForGroq: GroqMessage[] = [
        systemMessage,
        ...recentHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      ];

      if (messagesForGroq.some((msg) => !msg.content?.trim())) {
        throw new InternalServerErrorException(
          'Mensagem vazia encontrada no histórico',
        );
      }

      const response: GroqResponse = (await this.groq.chat.completions.create({
        messages: messagesForGroq,
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      })) as GroqResponse;

      const generatedResponse =
        response.choices[0]?.message?.content ?? 'Sem resposta da IA.';

      history.push({
        role: 'assistant',
        content: generatedResponse,
        createdAt: new Date(),
      });

      this.conversationHistory.set(sessionId, history);

      return {
        response: generatedResponse,
        sessionId,
      };
    } catch (error: unknown) {
      console.error('Erro na API da Groq:', error);
      throw new InternalServerErrorException('Erro ao consultar a API da Groq');
    }
  }
}
