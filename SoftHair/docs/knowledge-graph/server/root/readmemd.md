# README.md

**Repository:** Server
**File:** `README.md`
**Language:** `markdown`

---

#server #source

## Resumo

Arquivo `README.md` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/servicos|servicos]]
- [[domains/produtos|produtos]]
- [[domains/vendas|vendas]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]

- [[desktop/entities/sistema-de-administrao-de-salo-de-beleza-b8fe2e43|Sistema de Administração de Salão de Beleza]]

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```markdown
# SOFT-HAIR-SERVER

Servidor centralizado do SoftHair - API REST baseada em PostgreSQL para desktop e mobile.

## Instalação Rápida

```bash
# 1. Dependencies
npm install

# 2. Database (PostgreSQL)
createdb softhair_central  # opcional, use string conexao em DATABASE_URL

# 3. Configure environment
cp .env.example .env       # edite variaveis

# 4. Init database (tables + schema)  
npm run db:init

# 5. Start server
npm run dev  # development
npm start    # production
```

## Health Check
```bash
curl http://localhost:3000/api/health
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Registrar salao
- `POST /api/auth/login` - Fazer login

### Recursos (CRUD)
- Clientes: `/api/clientes`
- Profissionais: `/api/profissionais`
- Serviços: `/api/servicos`
- Produtos: `/api/produtos`
- Agendamentos: `/api/agendamentos`
- Vendas: `/api/vendas`
- Comissoes: `/api/comissoes`
- Fechamentos: `/api/fechamentos`
- Creditos: `/api/creditos`
- Notificações: `/api/notificacoes`

### Sync
- `GET /api/sync/changes` - Get changes since timestamp
- `POST /api/sync/push` - Send local changes
- `GET /api/sync/last-sync` - Get last sync timestamp

### Admin
- `GET /api/saloes` - List salons (admin)
- `GET /api/backup` - Create database backup

## Features

✅ JWT Authentication (7d tokens)  
✅ Multi-tenancy (salao_id isolation)  
✅ Validation with express-validator  
✅ Rate limiting 
✅ CORS  
✅ Offline-first sync support  
✅ CRUD operations for all entities  
✅ Query filtering & search  
✅ PostgreSQL transactions support  

## Scripts

- `npm run db:init` - Initialize database
- `npm run db:migrate` - Run migrations  
- `npm run db:backup` - Create backup

## Environment Variables

**Required:**
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - JWT signing key
- `API_KEY_MASTER` - Master API key

**Server:**
- `PORT=3000` - Server port
- `NODE_ENV=production` - Environment

## Production Checklist

- Generate secure secrets
- Configure SSL certificates  
- Setup PostgreSQL backups  
- Enable backups with cron  
- Set NODE_ENV=production  
- Configure allowed origins (CORS)  

## Migration from Local DB

See MIGRATION-GUIDE.md for detailed instructions.
```
