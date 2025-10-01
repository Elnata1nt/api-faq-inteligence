import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as mammoth from 'mammoth';
import winkBM25 from 'wink-bm25-text-search';
import { its } from 'wink-bm25-text-search';
import type { BM25Instance } from 'wink-bm25-text-search';
import {
  RAG_CHUNK_OVERLAP,
  RAG_CHUNK_WORDS,
  RAG_DOCS_DIR,
  RAG_INDEX_PATH,
  RAG_MIN_SCORE,
  RAG_TOP_K,
} from './rag.constants';

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
  private bm25: BM25Instance = winkBM25();

  constructor() {
    void this.bootstrap();
  }

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
        return;
      }
      this.logger.warn(
        'Índice não encontrado. Tentando indexar último DOCX disponível…',
      );
      const latest = this.findLatestDocx();
      if (latest) await this.indexDocx(latest);
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

  /** Reconstrói o índice BM25 a partir de chunks */
  private rebuildIndex(chunks: Chunk[]) {
    // Configura tokenizer / normalizador
    this.bm25 = winkBM25();
    this.bm25.defineConfig({ fldWeights: { text: 1 } });
    this.bm25.definePrepTasks([
      its.tokenize(),
      its.stem(),
      its.removeStopWords(),
      its.toLowerCase(),
      its.propagateNegation(),
    ]);

    chunks.forEach((c) => {
      this.bm25.addDoc({ _id: c.id, text: c.text });
    });
    this.bm25.consolidate();
  }

  /** Extrai texto de um .docx usando mammoth */
  private async extractTextFromDocx(fullPath: string): Promise<string> {
    const buf = fs.readFileSync(fullPath);
    const result = await mammoth.extractRawText({ buffer: buf });
    return (result.value || '').replace(/\n{2,}/g, '\n').trim();
  }

  /** Indexa um arquivo DOCX (substitui índice atual) */
  async indexDocx(fullPath: string) {
    this.logger.log(`Indexando DOCX: ${fullPath}`);
    const text = await this.extractTextFromDocx(fullPath);
    const chunks = this.chunkify(text);

    this.rebuildIndex(chunks);
    this.chunks = chunks;

    // Persistência
    const indexJSON = this.bm25.exportJSON();
    const payload: SavedIndex = { chunks, indexJSON };
    fs.mkdirSync(path.dirname(RAG_INDEX_PATH), { recursive: true });
    fs.writeFileSync(RAG_INDEX_PATH, JSON.stringify(payload), 'utf8');

    this.logger.log(`Indexação concluída: ${chunks.length} chunks.`);
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
}
