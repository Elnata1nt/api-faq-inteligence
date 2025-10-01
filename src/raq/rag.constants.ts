export const RAG_DOCS_DIR = 'src/storage/docs';
export const RAG_INDEX_PATH = 'src/storage/index.json';

export const RAG_CHUNK_WORDS = 400; // ~300–500 é bom
export const RAG_CHUNK_OVERLAP = 60; // sobreposição para manter contexto
export const RAG_TOP_K = 4; // número de trechos retornados
export const RAG_MIN_SCORE = 3.2; // ajuste fino após testar

export const OUT_OF_SCOPE_REPLY =
  'você pode solicitar o atendimento personalizado.';
