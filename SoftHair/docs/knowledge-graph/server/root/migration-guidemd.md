# MIGRATION-GUIDE.md

**Repository:** Server
**File:** `MIGRATION-GUIDE.md`
**Language:** `markdown`

---

#server #source

## Resumo

Arquivo `MIGRATION-GUIDE.md` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/servicos|servicos]]
- [[domains/produtos|produtos]]
- [[domains/vendas|vendas]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/security|security]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]
- [[domains/state|state]]

- [[server/entities/soft-hair-server-213a3f56|SOFT-HAIR-SERVER]]

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```markdown
# Guia de Migração - SoftHair para Servidor Centralizado

Este guia explica como migrar o SoftHair Desktop para usar o SOFT-HAIR-SERVER como backend centralizado.

## 📋 Resumo da Arquitetura

```
┌─────────────────────┐     HTTP/HTTPS      ┌─────────────────────┐
│   SoftHair Desktop  │ ◄─────────────────► │  SOFT-HAIR-SERVER   │
│   (React + Vite)    │                     │  (Express + Postgres)│
│   - Sync Offline    │                     │  - Auth JWT         │
│   - Local caching   │                     │  - Multi-tenant     │
└─────────────────────┘                     └─────────────────────┘
         │                                           │
         │ LocalStorage/IndexedDB                    │ PostgreSQL
         │                                           │
         ▼                                           ▼
  ┌───────────────┐                          ┌───────────────┐
  │ Pending Queue │                          │  Central DB   │
  │ (Offline)     │                          │  (Business)   │
  └───────────────┘                          └───────────────┘
```

## 🚀 Passos para Migração

### 1. Configurar SOFT-HAIR-SERVER

```bash
cd /home/ogejota/MONEY/SOFT-HAIR-SERVER

# Configurar PostgreSQL
sudo -u postgres psql
createdb softhair_central;
CREATE USER softhair WITH PASSWORD 'softhair123';
GRANT ALL PRIVILEGES ON DATABASE softhair_central TO softhair;

# Configurar .env
cp .env.example .env
# Editar: DATABASE_URL, JWT_SECRET, API_KEY_MASTER

# Instalar dependencias e iniciar
npm install
npm run start
```

### 2. Configurar SoftHair Desktop

```bash
cd /home/ogejota/MONEY/SoftHair/frontend

# Criar .env do cliente
cp .env.example .env
# Editar: VITE_API_URL=http://localhost:3000/api

# Instalar Dexie (offline database)
npm install dexie
```

### 3. Atualizar Serviços do Frontend

No SoftHair, substituir chamadas diretas ao banco por requisições API:

**ANTES** (acesso direto ao SQLite/Postgres local):
```javascript
const { data, error } = await supabase 
  .from('clientes')
  .select('*');
```

**DEPOIS** (via API do servidor):
```javascript
import syncManager from '../syncManager';

const { data, error } = await syncManager.getClientes();
// ou para criar:
const result = await syncManager.createCliente({ nome, telefone });
```

### 4. Implementar Sync Manager

O arquivo `SoftHair/frontend/src/syncManager.js` já foi criado. Importe e use onde precisar:

```javascript
import syncManager from './syncManager';

// Criar cliente (funciona online e offline)
const result = await syncManager.createCliente({
  nome: 'Cliente Teste',
  telefone: '(11) 99999-9999'
});

if (result.success) {
  // SEMPRE salvar ID local para atualizações futuras
  const clienteId = result.data.id;
  // result.offline === true se foi criado offline
}
```

### 5. Configurar Login

```javascript
import { apiClient } from './services/serverApi';

// Login
async function handleLogin(email, senha) {
  const result = await apiClient.login(email, senha);
  if (result.success) {
    // Token salvo automaticamente em localStorage
    return result.user;
  }
}
```

### 6. Monitorar Status Online

```javascript
import syncManager from './syncManager';

function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(syncManager.getOnlineStatus());
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
    
    window.addEventListener('sync-complete', () => {
      console.log('✅ Dados sincronizados!');
      setPendingCount(syncManager.getPendingChangesCount());
    });
  }, []);

  return {
    isOnline,
    pendingChanges: syncManager.getPendingChangesCount(),
    lastSync: syncManager.getLastSync()
  };
}
```

## 🔧 Atualizações Implementadas

### SOFT-HAIR-SERVER
✅ Models (BaseModel, Cliente, Profissional, Servico, Produto, etc)
✅ Services (ClienteService, ProfissionalService, ServicoService, etc)
✅ Rotas REST (CRUD completo com validações)
✅ Scripts (initDb, backup, migrate)
✅ Utils/helpers
✅ Auth JWT multi-tenancy
✅ Sync endpoints
✅ .env configurado

### SoftHair Desktop
✅ serverApi.js - Cliente Axios para API do servidor
✅ syncManager.js - Gerenciador offline/online
✅ .env.example - Config para conexão

## 📡 Endpoints da API

### Autenticação
- `POST /api/auth/login` - Login com email/senha
- `POST /api/auth/register` - Registrar novo salão
- `GET /api/auth/profile` - Perfil do usuário

### Clientes
- `GET /api/clientes` - Listar clientes
- `GET /api/clientes/:id` - Buscar cliente
- `POST /api/clientes` - Criar cliente
- `PUT /api/clientes/:id` - Atualizar cliente
- `DELETE /api/clientes/:id` - Remover cliente (soft)
- `PUT /api/clientes/:id/credito` - Adicionar crédito

### Profissionais, Serviços, Produtos, Agendamentos, Vendas
Mesmo padrão: GET, GET/:id, POST, PUT/:id, DELETE/:id

### Sync
- `GET /api/sync/changes` - Buscar mudanças do servidor
- `POST /api/sync/push` - Enviar mudanças pendentes
- `GET /api/sync/last-sync` - Timestamp última sync

## 🧪 Testando

### Testar Conexão Servidor
```bash
cd /home/ogejota/MONEY/SOFT-HAIR-SERVER
npm run dev

curl http://localhost:3000/api/health
```

### Testar Frontend
```bash
cd /home/ogejota/MONEY/SoftHair/frontend
npm run dev
```

## ⚠️ Notas Importantes

1. **Offline-First**: Todos os serviços do `syncManager` operam offline quando possível, enfileirando mudanças para sincronização posterior.

2. **IDs Locais**: Quando criado offline, registros recebem ID temporário (`local-${timestamp}`) que deve ser substituído pelo ID real do servidor após sync.

3. **Conflitos**: Se houver conflitos de dados durante sync, o servidor é a fonte da verdade.

4. **Retry**: Mudanças que falham são retentadas até 3x automaticamente.

## 🔄 Workflow de Uso

1. Desktop inicia verificando conexão `syncManager.getOnlineStatus()`
2. Se online: busca dados do servidor (`syncManager.getClientes()`)
3. Usuário realiza operações CRUD via `syncManager`
4. Operações acontecem:
   - Se offline: enfileiradas em `localStorage`
   - Se online: enviadas direto para servidor
5. Quando volta online: `syncManager.syncData()` processa fila

## 📂 Estrutura de Arquivos

```
/home/ogejota/MONEY/
├── SOFT-HAIR-SERVER/
│   ├── src/
│   │   ├── config/        # Database, InitDb
│   │   ├── models/        # CRUD models
│   │   ├── services/      # Business logic
│   │   ├── routes/        # API REST
│   │   ├── middleware/    # Auth, validation
│   │   ├── scripts/       # Db init, backup
│   │   └── utils/         # Helper functions
│   ├── .env.example
│   └── package.json
│
└── SoftHair/frontend/
    ├── src/
    │   ├── services/
    │   │   └── serverApi.js     ← Cliente API
    │   └── syncManager.js       ← Queue cache
    ├── .env.example
    └── package.json

```
```
