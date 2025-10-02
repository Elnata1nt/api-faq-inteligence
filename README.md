# RAG Backend - Sistema de FAQ com IA

Backend NestJS com sistema RAG (Retrieval-Augmented Generation) e integração com Groq AI para respostas contextualizadas baseadas em documentos.

## Arquitetura

### Módulos Principais

#### 1. **RAG Module** (`src/rag/`)
Sistema de indexação e busca de documentos usando BM25 com persistência em PostgreSQL.

- **rag.service.ts**: Serviço principal que gerencia:
  - Extração de texto de arquivos DOCX usando Mammoth
  - Chunking de documentos (divisão em pedaços de ~400 palavras com overlap de 60)
  - Indexação usando algoritmo BM25 (wink-bm25-text-search)
  - Busca semântica com score de relevância
  - Persistência do índice em JSON e metadados no PostgreSQL
  - CRUD completo de documentos

- **rag.controller.ts**: Endpoints REST:
  - `POST /api/rag/upload`: Upload de arquivos DOCX
  - `GET /api/rag/documents`: Listar todos os documentos
  - `GET /api/rag/documents/:id`: Detalhes de um documento
  - `DELETE /api/rag/documents/:id`: Deletar documento
  - `POST /api/rag/reindex-latest`: Reindexação do último documento

- **rag.constants.ts**: Configurações do sistema:
  - `RAG_CHUNK_WORDS`: 400 palavras por chunk
  - `RAG_CHUNK_OVERLAP`: 60 palavras de sobreposição
  - `RAG_TOP_K`: 4 chunks retornados por busca
  - `RAG_MIN_SCORE`: 3.2 score mínimo de relevância

#### 2. **IA-FAQ Module** (`src/ia-faq/`)
Sistema de chat com IA usando Groq e contexto do RAG com histórico persistente.

- **ia-faq.service.ts**: Serviço de chat que:
  - Integra com Groq AI (modelo Llama 4 Scout)
  - Recupera contexto relevante do RAG
  - Mantém histórico de conversação por sessão no PostgreSQL (últimas 20 mensagens)
  - Gera respostas contextualizadas
  - Retorna mensagem padrão quando não há contexto relevante
  - Gerencia sessões de chat

- **ia-faq.controller.ts**: Endpoints REST:
  - `POST /api/chat`: Envio de mensagens e recebimento de respostas
  - `GET /api/chat/sessions`: Listar todas as sessões
  - `GET /api/chat/sessions/:id`: Detalhes de uma sessão
  - `DELETE /api/chat/sessions/:id`: Deletar sessão

- **dto/create-ia-faq.dto.ts**: DTO para requisições de chat

#### 3. **Prisma Module** (`src/prisma/`)
Módulo global de integração com PostgreSQL.

- **prisma.service.ts**: Serviço Prisma com:
  - Conexão automática ao banco
  - Logging de queries em desenvolvimento
  - Helper para limpar banco em desenvolvimento

- **prisma.module.ts**: Módulo global exportado para toda aplicação

### Banco de Dados (PostgreSQL)

#### Modelos:

- **Document**: Metadados dos documentos DOCX
  - id, filename, originalName, filepath, filesize, content, indexed, timestamps
  
- **DocumentChunk**: Chunks dos documentos para busca granular
  - id, documentId, content, chunkIndex

- **ChatSession**: Sessões de conversação
  - id, timestamps

- **Message**: Mensagens do chat
  - id, sessionId, role, content, metadata, timestamp

- **IaFaq**: FAQs do sistema (para futuro uso)
  - id, question, answer, category, active, timestamps

### Fluxo de Funcionamento

\`\`\`
1. Upload de Documento (DOCX)
   ↓
2. Extração de Texto (Mammoth)
   ↓
3. Chunking (400 palavras + 60 overlap)
   ↓
4. Indexação BM25
   ↓
5. Persistência (index.json + PostgreSQL)
   ↓
6. Salvar metadados e chunks no banco

---

Usuário faz pergunta
   ↓
Criar/Recuperar sessão no banco
   ↓
Salvar mensagem do usuário
   ↓
Busca BM25 (top 4 chunks)
   ↓
Filtra por score >= 3.2
   ↓
Se relevante: Envia contexto + histórico para Groq AI
   ↓
Se não relevante: Retorna mensagem padrão
   ↓
Salvar resposta da IA no banco
   ↓
Resposta ao usuário
\`\`\`

## Instalação

\`\`\`bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env e adicionar GROQ_API_KEY e DATABASE_URL

# Subir o banco de dados com Docker
npm run docker:up

# Gerar Prisma Client
npm run prisma:generate

# Executar migrações
npm run prisma:migrate

# (Opcional) Popular dados iniciais
# Execute o script SQL em scripts/seed-initial-data.sql
\`\`\`

## Executar

\`\`\`bash
# Desenvolvimento
npm run start:dev

# Produção
npm run build
npm run start:prod
\`\`\`

## Scripts Úteis

\`\`\`bash
# Docker
npm run docker:up          # Subir containers
npm run docker:down        # Parar containers
npm run docker:logs        # Ver logs

# Prisma
npm run prisma:generate    # Gerar Prisma Client
npm run prisma:migrate     # Executar migrações
npm run prisma:studio      # Abrir Prisma Studio (GUI)
\`\`\`

## Endpoints da API

### RAG - Gerenciamento de Documentos

**POST** `/api/rag/upload`
- Content-Type: `multipart/form-data`
- Body: `file` (arquivo .docx, máx 20MB)
- Response:
\`\`\`json
{
  "ok": true,
  "document": {
    "id": "uuid",
    "filename": "file_123.docx",
    "originalName": "file.docx",
    "filesize": 12345,
    "chunks": 10
  }
}
\`\`\`

**GET** `/api/rag/documents`
- Lista todos os documentos
- Response:
\`\`\`json
{
  "ok": true,
  "documents": [
    {
      "id": "uuid",
      "filename": "file.docx",
      "originalName": "file.docx",
      "filesize": 12345,
      "indexed": true,
      "uploadedAt": "2025-01-10T...",
      "_count": { "chunks": 10 }
    }
  ]
}
\`\`\`

**GET** `/api/rag/documents/:id`
- Detalhes de um documento específico
- Response:
\`\`\`json
{
  "ok": true,
  "document": {
    "id": "uuid",
    "filename": "file.docx",
    "content": "...",
    "chunks": [...]
  }
}
\`\`\`

**DELETE** `/api/rag/documents/:id`
- Deleta documento do banco e disco
- Response: `{ ok: true, filename: "file.docx" }`

**POST** `/api/rag/reindex-latest`
- Reindexa o último documento DOCX disponível
- Response: `{ ok: true, file: "filename.docx" }`

### Chat - Conversação com IA

**POST** `/api/chat`
- Content-Type: `application/json`
- Body:
\`\`\`json
{
  "message": "Sua pergunta aqui",
  "sessionId": "uuid-opcional"
}
\`\`\`
- Response:
\`\`\`json
{
  "response": "Resposta da IA",
  "sessionId": "uuid-da-sessao"
}
\`\`\`

**GET** `/api/chat/sessions`
- Lista todas as sessões de chat
- Response:
\`\`\`json
{
  "ok": true,
  "sessions": [
    {
      "id": "uuid",
      "createdAt": "...",
      "updatedAt": "...",
      "_count": { "messages": 5 }
    }
  ]
}
\`\`\`

**GET** `/api/chat/sessions/:id`
- Detalhes de uma sessão com todas as mensagens
- Response:
\`\`\`json
{
  "ok": true,
  "session": {
    "id": "uuid",
    "messages": [
      {
        "role": "user",
        "content": "...",
        "createdAt": "..."
      }
    ]
  }
}
\`\`\`

**DELETE** `/api/chat/sessions/:id`
- Deleta uma sessão e todas suas mensagens
- Response: `{ ok: true }`

## Estrutura de Diretórios

\`\`\`
src/
├── main.ts                 # Bootstrap da aplicação
├── app.module.ts           # Módulo raiz
├── app.controller.ts       # Controller raiz
├── app.service.ts          # Service raiz
├── prisma/                 # Módulo Prisma
│   ├── prisma.service.ts   # Serviço Prisma
│   └── prisma.module.ts    # Módulo global
├── rag/                    # Módulo RAG
│   ├── rag.constants.ts    # Constantes de configuração
│   ├── rag.service.ts      # Serviço de indexação/busca
│   ├── rag.controller.ts   # Endpoints de upload
│   └── rag.module.ts       # Módulo RAG
├── ia-faq/                 # Módulo IA-FAQ
│   ├── ia-faq.service.ts   # Serviço de chat com Groq
│   ├── ia-faq.controller.ts # Endpoint de chat
│   ├── ia-faq.module.ts    # Módulo FAQ
│   └── dto/
│       └── create-ia-faq.dto.ts # DTO de requisição
├── storage/                # Armazenamento
│   ├── docs/               # Documentos DOCX
│   └── index.json          # Índice BM25 persistido
prisma/
└── schema.prisma           # Schema do banco de dados
scripts/
└── seed-initial-data.sql   # Script de seed
docker-compose.yml          # Configuração Docker
\`\`\`

## Tecnologias

- **NestJS**: Framework backend
- **PostgreSQL**: Banco de dados relacional
- **Prisma**: ORM para TypeScript
- **Docker**: Containerização do banco
- **Groq SDK**: Integração com Groq AI (Llama 4)
- **wink-bm25-text-search**: Algoritmo BM25 para busca
- **Mammoth**: Extração de texto de DOCX
- **Multer**: Upload de arquivos
- **UUID**: Geração de IDs

## Configuração CORS

O servidor aceita requisições de:
- `https://elnata-nexa-ia-frontend.cc6xgb.easypanel.host`
- `https://elnata-holodeckhubb.cc6xgb.easypanel.host`
- `http://localhost:9000`
- `http://localhost:3000`

## Acesso ao Banco de Dados

### Prisma Studio (GUI)
\`\`\`bash
npm run prisma:studio
\`\`\`
Acesse: http://localhost:5555

### pgAdmin (GUI)
Acesse: http://localhost:5050
- Email: admin@rag.local
- Senha: admin

### Conexão Direta
\`\`\`
Host: localhost
Port: 5432
Database: ragdb
Username: raguser
Password: ragpassword
\`\`\`

## Desenvolvido por

**Holodeck Hub** - Fundada por Elnata Correa
