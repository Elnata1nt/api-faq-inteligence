# Docker & Database Setup

## Pré-requisitos

- Docker e Docker Compose instalados
- Node.js 18+ instalado

## Iniciando o Banco de Dados

1. **Subir os containers:**
   \`\`\`bash
   npm run docker:up
   \`\`\`

2. **Verificar se está rodando:**
   \`\`\`bash
   docker ps
   \`\`\`

3. **Ver logs do PostgreSQL:**
   \`\`\`bash
   npm run docker:logs
   \`\`\`

## Configuração do Prisma

1. **Gerar o Prisma Client:**
   \`\`\`bash
   npm run prisma:generate
   \`\`\`

2. **Executar migrações:**
   \`\`\`bash
   npm run prisma:migrate
   \`\`\`

3. **Abrir Prisma Studio (interface visual):**
   \`\`\`bash
   npm run prisma:studio
   \`\`\`
   Acesse: http://localhost:5555

## Acessando o pgAdmin

- URL: http://localhost:5050
- Email: admin@rag.local
- Senha: admin

### Conectar ao PostgreSQL no pgAdmin:

1. Clique em "Add New Server"
2. **General Tab:**
   - Name: RAG Database
3. **Connection Tab:**
   - Host: postgres
   - Port: 5432
   - Database: ragdb
   - Username: raguser
   - Password: ragpassword

## Parando os Containers

\`\`\`bash
npm run docker:down
\`\`\`

## Estrutura de Volumes

- `postgres_data`: Dados persistentes do PostgreSQL
- `./uploads`: Arquivos DOCX enviados (compartilhado com o container)

## Troubleshooting

### Porta 5432 já em uso
Se você já tem PostgreSQL instalado localmente, pare o serviço ou mude a porta no docker-compose.yml:
\`\`\`yaml
ports:
  - '5433:5432'  # Usa porta 5433 no host
\`\`\`

E atualize a DATABASE_URL no .env:
\`\`\`
DATABASE_URL=postgresql://raguser:ragpassword@localhost:5433/ragdb
\`\`\`

### Resetar o banco de dados
\`\`\`bash
npm run docker:down
docker volume rm rag-backend_postgres_data
npm run docker:up
npm run prisma:migrate
