-- Script para popular dados iniciais no banco de dados
-- Execute após rodar as migrações do Prisma

-- Inserir FAQs iniciais
INSERT INTO ia_faqs (id, question, answer, category, active, created_at, updated_at)
VALUES
  (
    gen_random_uuid(),
    'Como faço upload de documentos?',
    'Você pode fazer upload de documentos DOCX através do endpoint POST /rag/upload. O sistema irá processar e indexar automaticamente o conteúdo para buscas.',
    'upload',
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Quais tipos de arquivo são suportados?',
    'Atualmente o sistema suporta apenas arquivos no formato DOCX (Microsoft Word). Outros formatos serão adicionados em versões futuras.',
    'upload',
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Como funciona a busca RAG?',
    'O sistema RAG (Retrieval-Augmented Generation) busca nos documentos indexados usando BM25, recupera os trechos mais relevantes e usa IA para gerar respostas contextualizadas baseadas no conteúdo encontrado.',
    'rag',
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Posso deletar documentos enviados?',
    'Sim, você pode deletar documentos através do endpoint DELETE /rag/documents/:id. Isso removerá o documento do índice e do sistema de arquivos.',
    'gerenciamento',
    true,
    NOW(),
    NOW()
  );

-- Criar índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_ia_faqs_question ON ia_faqs USING gin(to_tsvector('portuguese', question));
