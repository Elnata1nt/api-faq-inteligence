# Arquitetura Detalhada - RAG Backend

## Visão Geral

Sistema backend construído com NestJS que implementa um chatbot inteligente usando RAG (Retrieval-Augmented Generation) para fornecer respostas contextualizadas baseadas em documentos corporativos.

## Componentes Principais

### 1. Sistema RAG (Retrieval-Augmented Generation)

#### Algoritmo BM25
- **Biblioteca**: wink-bm25-text-search
- **Função**: Ranking de relevância de documentos
- **Configuração**:
  - Tokenização
  - Stemming (redução de palavras à raiz)
  - Remoção de stopwords (PT/EN)
  - Normalização (lowercase)
  - Propagação de negação

#### Chunking Strategy
- **Tamanho do Chunk**: 400 palavras
- **Overlap**: 60 palavras
- **Motivo**: Manter contexto entre chunks adjacentes
- **Implementação**: Sliding window sobre array de palavras

#### Indexação
- **Formato**: JSON persistido em disco
- **Estrutura**:
\`\`\`typescript
{
  chunks: [
    { id: "c_0", text: "...", meta: {} },
    { id: "c_1", text: "...", meta: {} }
  ],
  indexJSON: { /* estrutura interna do BM25 */ }
}
\`\`\`

#### Busca e Retrieval
1. Query do usuário é tokenizada
2. BM25 retorna top-K chunks (K=4)
3. Filtragem por score mínimo (3.2)
4. Concatenação de chunks relevantes
5. Se nenhum chunk relevante: retorna null

### 2. Sistema de Chat com IA

#### Integração Groq AI
- **Modelo**: meta-llama/llama-4-scout-17b-16e-instruct
- **SDK**: groq-sdk
- **Configuração**: API Key via variável de ambiente

#### Gerenciamento de Contexto
- **Histórico por Sessão**: Map<sessionId, Message[]>
- **Limite**: Últimas 20 mensagens
- **Ordenação**: Cronológica (mais antigas primeiro)
- **Estrutura de Mensagem**:
\`\`\`typescript
{
  role: 'user' | 'assistant',
  content: string,
  createdAt: Date
}
\`\`\`

#### Prompt Engineering
\`\`\`
System Prompt:
- Identidade: IA da Holodeck Hub
- Restrição: Responder apenas com base no contexto fornecido
- Fallback: Mensagem padrão se resposta não estiver no contexto
- Contexto: Chunks relevantes do RAG
\`\`\`

#### Fluxo de Conversação
1. Recebe mensagem + sessionId (opcional)
2. Gera sessionId se não fornecido (UUID v4)
3. Adiciona mensagem ao histórico
4. Busca contexto no RAG
5. Se sem contexto: retorna mensagem padrão
6. Se com contexto: monta prompt com sistema + histórico + contexto
7. Envia para Groq AI
8. Adiciona resposta ao histórico
9. Retorna resposta + sessionId

### 3. Sistema de Upload e Processamento

#### Upload de Documentos
- **Formato Aceito**: .docx
- **Tamanho Máximo**: 20MB
- **Storage**: Disco local (src/storage/docs/)
- **Naming**: `{nome_original}_{timestamp}.docx`

#### Extração de Texto
- **Biblioteca**: Mammoth
- **Processo**:
  1. Lê buffer do arquivo
  2. Extrai texto bruto
  3. Remove quebras de linha excessivas
  4. Trim de espaços

#### Reindexação
- **Automática**: No bootstrap se índice não existir
- **Manual**: Endpoint POST /api/rag/reindex-latest
- **Estratégia**: Sempre usa o documento mais recente (por mtime)

## Padrões de Projeto

### Dependency Injection
- NestJS gerencia todas as dependências
- Services são singleton por padrão
- Módulos encapsulam funcionalidades relacionadas

### Separation of Concerns
- **Controllers**: Apenas validação e roteamento
- **Services**: Lógica de negócio
- **DTOs**: Validação de entrada
- **Constants**: Configurações centralizadas

### Error Handling
- Exceptions do NestJS (BadRequestException, InternalServerErrorException)
- Logging estruturado com Logger do NestJS
- Try-catch em operações críticas

## Segurança

### CORS
- Whitelist de origens permitidas
- Métodos HTTP específicos
- Headers controlados
- Credentials habilitado

### Upload
- Validação de tipo de arquivo
- Limite de tamanho
- Sanitização de nome de arquivo

### API Keys
- Groq API Key via variável de ambiente
- Não exposta em logs ou respostas

## Performance

### Otimizações
- Índice BM25 em memória (rápido)
- Persistência em disco (durabilidade)
- Histórico limitado (20 mensagens)
- Chunks com overlap (melhor contexto)

### Escalabilidade
- Stateless (exceto histórico em memória)
- Pode ser escalado horizontalmente com Redis para histórico
- Índice pode ser movido para banco vetorial (Pinecone, Weaviate)

## Melhorias Futuras

1. **Persistência de Histórico**: Redis ou PostgreSQL
2. **Banco Vetorial**: Substituir BM25 por embeddings + vector DB
3. **Multi-documento**: Suporte a múltiplos documentos indexados
4. **Streaming**: Respostas em tempo real (SSE ou WebSocket)
5. **Analytics**: Tracking de perguntas e qualidade de respostas
6. **Cache**: Cache de respostas frequentes
7. **Rate Limiting**: Proteção contra abuso
8. **Authentication**: JWT ou OAuth2
9. **Webhooks**: Notificações de eventos
10. **Admin Dashboard**: Interface para gerenciar documentos e monitorar uso
