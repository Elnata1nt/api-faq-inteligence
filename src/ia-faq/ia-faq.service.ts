/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { OUT_OF_SCOPE_REPLY } from 'src/raq/rag.constants';
import { RagService } from 'src/raq/raq.service';
import { v4 as uuidv4 } from 'uuid';

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

  constructor(
    private configService: ConfigService, // sem 'type'
    private readonly rag: RagService,
  ) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'A chave da API da Groq não foi fornecida.',
      );
    }
    this.groq = new Groq({ apiKey });
  }

  private generateUuid(): string {
    const id: string = uuidv4();
    return id;
  }

  private addMessageToHistory(sessionId: string, message: Message): void {
    const history = this.conversationHistory.get(sessionId) || [];
    history.push(message);
    this.conversationHistory.set(sessionId, history);
  }

  private buildMessageHistory(sessionId: string): GroqMessage[] {
    const history = this.conversationHistory.get(sessionId) || [];
    const recentHistory = history
      .slice(-20)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return recentHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  async getChatCompletion(
    message: string,
    sessionId?: string,
  ): Promise<{ response: string; sessionId: string }> {
    try {
      if (!sessionId) {
        sessionId = this.generateUuid();
      }

      const userMessage: Message = {
        role: 'user',
        content: message,
        createdAt: new Date(),
      };

      this.addMessageToHistory(sessionId, userMessage);

      // 🔎 Recupera contexto do RAG
      const context = this.rag.getContextOrNull(message);

      if (!context) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: OUT_OF_SCOPE_REPLY,
          createdAt: new Date(),
        };
        this.addMessageToHistory(sessionId, assistantMessage);
        return { response: OUT_OF_SCOPE_REPLY, sessionId };
      }

      const messagesForGroq: GroqMessage[] = [
        {
          role: 'system',
          content: `
Você é uma IA desenvolvida pela Holodeck Hub, fundada por Elnata Correa.
Responda exclusivamente com base no conteúdo abaixo.
Se a resposta não estiver claramente contida aqui, diga: "${OUT_OF_SCOPE_REPLY}".

---
${context}
---
          `.trim(),
        },
        ...this.buildMessageHistory(sessionId),
      ];

      const response = (await this.groq.chat.completions.create({
        messages: messagesForGroq,
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      })) as GroqResponse;

      const generatedResponse =
        response.choices[0]?.message?.content ?? 'Sem resposta da IA.';

      const assistantMessage: Message = {
        role: 'assistant',
        content: generatedResponse,
        createdAt: new Date(),
      };

      this.addMessageToHistory(sessionId, assistantMessage);

      return { response: generatedResponse, sessionId };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Erro na API da Groq:', error.message);
      } else {
        console.error('Erro desconhecido na API da Groq:', error);
      }
      throw new InternalServerErrorException('Erro ao consultar a API da Groq');
    }
  }
}
