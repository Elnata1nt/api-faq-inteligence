import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as mammoth from 'mammoth';
import {
  RAG_CHUNK_OVERLAP,
  RAG_CHUNK_WORDS,
  RAG_DOCS_DIR,
  RAG_INDEX_PATH,
  RAG_MIN_SCORE,
  RAG_TOP_K,
} from './rag.constants';
import { PrismaService } from '../prisma/prisma.service';
import winkBM25, { BM25Instance, PrepTask } from 'wink-bm25-text-search';

type Chunk = {
  id: string;
  text: string;
  meta?: Record<string, unknown>;
};

type SavedIndex = {
  chunks: Chunk[];
  indexJSON: string;
};

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private chunks: Chunk[] = [];
  private bm25: BM25Instance;

  private consolidated = false;

  private static readonly prepTasks = {
    tokenize: () => (text: any) => (text as string).split(/\s+/),
    stem: () => (tokens: any) => tokens as string[],
    removeStopWords: () => (tokens: any) =>
      (tokens as string[]).filter(
        (t) => !['a', 'e', 'o', 'de', 'do', 'da'].includes(t),
      ),
    toLowerCase: () => (tokens: any) =>
      (tokens as string[]).map((t) => t.toLowerCase()),
    propagateNegation: () => (tokens: any) => tokens as string[],
  };

  constructor(private readonly prisma: PrismaService) {
    try {
      this.bm25 = this.createBM25Instance();
      this.logger.log('BM25 inicializado com sucesso');
      void this.bootstrap();
    } catch (error) {
      this.logger.error('Erro ao inicializar BM25:', error);
      throw error;
    }
  }

  private createBM25Instance(): BM25Instance {
    const instance = winkBM25();

    // Step 1: Define config FIRST
    instance.defineConfig({
      fldWeights: { text: 1 },
      bm25Params: { k1: 1.2, b: 0.75, k: 60 },
    });

    this.logger.debug('BM25 config definido');

    // Step 2: Define prepTasks AFTER config
    instance.definePrepTasks([
      RagService.prepTasks.tokenize() as unknown as PrepTask,
      RagService.prepTasks.stem() as unknown as PrepTask,
      RagService.prepTasks.removeStopWords() as unknown as PrepTask,
      RagService.prepTasks.toLowerCase() as unknown as PrepTask,
      RagService.prepTasks.propagateNegation() as unknown as PrepTask,
    ]);

    this.logger.debug('BM25 prepTasks definidos');

    return instance;
  }

  private initializeBM25() {
    try {
      this.bm25 = this.createBM25Instance();
      this.logger.debug('BM25 reinicializado');
    } catch (error) {
      this.logger.error('Erro ao reinicializar BM25:', error);
      throw error;
    }
  }

  /** NOVO: Consolida o índice BM25 manualmente */
  public consolidateIndex() {
    if (!this.consolidated) {
      this.bm25.consolidate();
      this.consolidated = true;
      this.logger.log('Índice BM25 consolidado manualmente.');
    }
  }

  /** NOVO: Retorna se o índice BM25 está consolidado */
  public isConsolidated(): boolean {
    return this.consolidated;
  }

  // Mantém todos os métodos existentes, apenas alterando getContextOrNull para garantir que índice esteja consolidado
  // public getContextOrNull(question: string): string | null {
  //   if (!this.consolidated) {
  //     this.logger.warn('BM25 não consolidado; consolidando automaticamente...');
  //     this.consolidateIndex();
  //   }

  //   const top = this.search(question);
  //   const strong = top.filter((r) => r.score >= RAG_MIN_SCORE);
  //   if (strong.length === 0) return null;
  //   return strong.map((r) => r.text).join('\n\n---\n\n');
  // }

  /** Carrega índice se existir; senão tenta criar a partir do último DOCX do diretório */
  private async bootstrap() {
    try {
      if (fs.existsSync(RAG_INDEX_PATH)) {
        this.logger.log('Carregando índice RAG do disco…');
        const raw = JSON.parse(
          fs.readFileSync(RAG_INDEX_PATH, 'utf8'),
        ) as SavedIndex;
        this.chunks = raw.chunks;
        this.bm25.importJSON(raw.indexJSON);
        this.logger.log(`Índice carregado: ${this.chunks.length} chunks`);
        return;
      }
      this.logger.warn(
        'Índice não encontrado. Tentando indexar último DOCX disponível…',
      );
      const latest = this.findLatestDocx();
      if (latest) {
        await this.indexDocx(latest);
      } else {
        this.logger.warn('Nenhum arquivo DOCX encontrado em RAG_DOCS_DIR');
      }
    } catch (err) {
      this.logger.error('Falha no bootstrap do RAG', err as Error);
    }
  }

  /** Retorna o caminho do .docx mais recente em RAG_DOCS_DIR */
  private findLatestDocx(): string | null {
    if (!fs.existsSync(RAG_DOCS_DIR)) return null;
    const files = fs
      .readdirSync(RAG_DOCS_DIR)
      .filter((f) => f.toLowerCase().endsWith('.docx'))
      .map((f) => ({ f, t: fs.statSync(path.join(RAG_DOCS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    return files[0] ? path.join(RAG_DOCS_DIR, files[0].f) : null;
  }

  /** Divide texto em chunks de ~N palavras com sobreposição */
  private chunkify(text: string): Chunk[] {
    const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

    const chunks: Chunk[] = [];
    let i = 0;
    let idCounter = 0;

    while (i < words.length) {
      const slice = words.slice(i, i + RAG_CHUNK_WORDS);
      const chunkText = slice.join(' ').trim();
      if (chunkText.length > 0) {
        chunks.push({ id: `c_${idCounter++}`, text: chunkText });
      }
      i += RAG_CHUNK_WORDS - RAG_CHUNK_OVERLAP;
      if (i < 0) break;
    }
    return chunks;
  }

  private rebuildIndex(chunks: Chunk[]) {
    try {
      this.logger.debug(`Reconstruindo índice com ${chunks.length} chunks`);
      this.initializeBM25();

      let docsAdded = 0;
      const timestamp = Date.now();

      chunks.forEach((c, index) => {
        if (!c.text || c.text.trim().length === 0) return;

        // Garante ID único para cada chunk
        const docId = c.id ?? `chunk_${index}_${timestamp}`;

        try {
          this.bm25.addDoc({ _id: docId, text: c.text });
          docsAdded++;

          if (index % 100 === 0) {
            this.logger.debug(
              `Adicionados ${index + 1}/${chunks.length} chunks`,
            );
          }
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : JSON.stringify(err);
          this.logger.error(`Erro ao adicionar chunk ${docId}: ${message}`);
        }
      });

      if (docsAdded < 2) {
        this.logger.warn(
          'Não há chunks suficientes para consolidar o índice BM25. Adicione mais chunks.',
        );
        return;
      }

      try {
        this.bm25.consolidate();
        this.logger.log(`Índice consolidado com sucesso: ${docsAdded} chunks`);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : JSON.stringify(err);
        this.logger.error('Erro ao consolidar índice BM25:', message);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : error;
      this.logger.error('Erro ao reconstruir índice:', msg);
      throw error;
    }
  }

  /** Extrai texto de um .docx usando mammoth */
  private async extractTextFromDocx(fullPath: string): Promise<string> {
    const buf = fs.readFileSync(fullPath);
    const result = await mammoth.extractRawText({ buffer: buf });
    return (result.value || '').replace(/\n{2,}/g, '\n').trim();
  }

  /** Indexa um arquivo DOCX (substitui índice atual) */
  async indexDocx(fullPath: string, originalName?: string) {
    try {
      this.logger.log(`Indexando DOCX: ${fullPath}`);

      const text = await this.extractTextFromDocx(fullPath);
      this.logger.debug(`Texto extraído: ${text.length} caracteres`);

      const chunks = this.chunkify(text);
      this.logger.debug(`Texto dividido em ${chunks.length} chunks`);

      this.rebuildIndex(chunks);
      this.chunks = chunks;

      // Persistência em arquivo (mantido para compatibilidade)
      const indexJSON = this.bm25.exportJSON();
      const payload: SavedIndex = { chunks, indexJSON };
      fs.mkdirSync(path.dirname(RAG_INDEX_PATH), { recursive: true });
      fs.writeFileSync(RAG_INDEX_PATH, JSON.stringify(payload), 'utf8');

      const stats = fs.statSync(fullPath);
      const filename = path.basename(fullPath);

      const document = await this.prisma.document.create({
        data: {
          filename,
          originalName: originalName || filename,
          filepath: fullPath,
          filesize: stats.size,
          content: text,
          indexed: true,
          chunks: {
            create: chunks.map((chunk, index) => ({
              content: chunk.text,
              chunkIndex: index,
            })),
          },
        },
        include: {
          chunks: true,
        },
      });

      this.logger.log(
        `Indexação concluída: ${chunks.length} chunks salvos no banco (Document ID: ${document.id}).`,
      );

      return document;
    } catch (err: unknown) {
      this.logger.error('Erro na indexação do DOCX:', err);
      let message = 'Erro desconhecido';
      if (err instanceof Error) {
        message = err.message;
      }
      throw new BadRequestException(`Falha ao processar o arquivo: ${message}`);
    }
  }

  /** Busca top-k chunks e devolve com score */
  search(question: string): { text: string; score: number }[] {
    const results = this.bm25.search(question).slice(0, RAG_TOP_K);
    return results
      .map((r: [string, number]) => {
        const c = this.chunks.find((x) => x.id === r[0]);
        return { text: c?.text ?? '', score: r[1] };
      })
      .filter((r) => r.text.length > 0);
  }

  /** Retorna contexto concatenado se houver relevância; caso contrário, null */
  getContextOrNull(question: string): string | null {
    const top = this.search(question);
    const strong = top.filter((r) => r.score >= RAG_MIN_SCORE);
    if (strong.length === 0) return null;
    return strong.map((r) => r.text).join('\n\n---\n\n');
  }

  async getAllDocuments() {
    return this.prisma.document.findMany({
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        filename: true,
        originalName: true,
        filesize: true,
        indexed: true,
        uploadedAt: true,
        _count: {
          select: { chunks: true },
        },
      },
    });
  }

  async getDocumentById(id: string) {
    return this.prisma.document.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });
  }

  async deleteDocument(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Delete file from disk
    if (fs.existsSync(document.filepath)) {
      fs.unlinkSync(document.filepath);
      this.logger.log(`Arquivo deletado: ${document.filepath}`);
    }

    // Delete from database (cascades to chunks)
    await this.prisma.document.delete({
      where: { id },
    });

    this.logger.log(`Documento removido do banco: ${document.filename}`);

    return { ok: true, filename: document.filename };
  }
}
