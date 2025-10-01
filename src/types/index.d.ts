declare module 'wink-bm25-text-search' {
  export interface BM25Config {
    fldWeights?: Record<string, number>;
    bm25Params?: {
      k1?: number;
      b?: number;
      k?: number;
    };
  }

  export type PrepTask = () => (tokens: string[]) => string[];

  export interface ITS {
    tokenize: () => PrepTask;
    stem: () => PrepTask;
    removeStopWords: () => PrepTask;
    toLowerCase: () => PrepTask;
    propagateNegation: () => PrepTask;
  }

  export const its: ITS;

  export interface BM25Instance {
    defineConfig(config: BM25Config): void;
    definePrepTasks(tasks: PrepTask[]): void;
    addDoc(doc: { _id: string; [key: string]: unknown }): void;
    consolidate(): void;
    search(query: string): Array<[string, number]>;
    exportJSON(): string;
    importJSON(json: string): void;
  }

  export default function winkBM25(): BM25Instance;
}

declare module 'mammoth' {
  export interface ExtractResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  export interface ExtractOptions {
    buffer?: Buffer;
    path?: string;
  }

  export function extractRawText(
    options: ExtractOptions,
  ): Promise<ExtractResult>;
}
