import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from 'src/raq/rag.service';
import { OUT_OF_SCOPE_REPLY } from 'src/raq/rag.constants';
import { ChatSession, Message } from '@prisma/client';

interface Choice {
  message: {
    content: string;
  };
}

interface GroqResponse {
  choices: Choice[];
}

interface GroqMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable()
export class IaMessageService {
  private groq: Groq;

  constructor(
    private configService: ConfigService,
    private readonly rag: RagService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'A chave da API da Groq não foi fornecida.',
      );
    }
    this.groq = new Groq({ apiKey });
  }

  private async buildMessageHistory(sessionId: string): Promise<GroqMessage[]> {
    const messages: Message[] = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return messages.reverse().map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));
  }

  async getChatCompletion(
    message: string,
    sessionId?: string,
  ): Promise<{ response: string; sessionId: string }> {
    try {
      let session: ChatSession;

      // Cria ou busca a sessão
      if (sessionId) {
        const found = await this.prisma.chatSession.findUnique({
          where: { id: sessionId },
        });
        session =
          found ||
          (await this.prisma.chatSession.create({ data: { id: sessionId } }));
      } else {
        session = await this.prisma.chatSession.create({ data: {} });
        sessionId = session.id;
      }

      // Salva a mensagem do usuário
      await this.prisma.message.create({
        data: { sessionId: session.id, role: 'user', content: message },
      });

      // Garante que o índice BM25 esteja consolidado antes da busca
      if (!this.rag.isConsolidated()) {
        this.rag.consolidateIndex();
      }

      const context = this.rag.getContextOrNull(message);

      // Se não houver contexto, retorna resposta padrão
      if (!context) {
        const assistantMessage = OUT_OF_SCOPE_REPLY;

        await this.prisma.message.create({
          data: {
            sessionId: session.id,
            role: 'assistant',
            content: assistantMessage,
          },
        });

        return { response: assistantMessage, sessionId: session.id };
      }

      // Monta histórico e sistema para Groq
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
        ...(await this.buildMessageHistory(session.id)),
      ];

      // Consulta a API da Groq
      const response = (await this.groq.chat.completions.create({
        messages: messagesForGroq,
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      })) as GroqResponse;

      const generatedResponse =
        response.choices[0]?.message?.content ?? 'Sem resposta da IA.';

      // Salva resposta da IA
      await this.prisma.message.create({
        data: {
          sessionId: session.id,
          role: 'assistant',
          content: generatedResponse,
          metadata: {
            hasContext: !!context,
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          },
        },
      });

      return { response: generatedResponse, sessionId: session.id };
    } catch (error: unknown) {
      console.error(
        'Erro na API da Groq:',
        error instanceof Error ? error.message : error,
      );
      throw new InternalServerErrorException('Erro ao consultar a API da Groq');
    }
  }

  async getSession(sessionId: string) {
    return this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async getAllSessions() {
    return this.prisma.chatSession.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async deleteSession(sessionId: string) {
    await this.prisma.chatSession.delete({ where: { id: sessionId } });
    return { ok: true };
  }
}
