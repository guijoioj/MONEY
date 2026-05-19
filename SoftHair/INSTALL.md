# SoftHair Desktop — Guia de Instalação

App Electron com banco SQLite local e sincronização opcional com servidor Render.

## Visão geral

```
[PC do salão]                       [Render — opcional]
+--------------------+               +----------------+
| SoftHair.exe       |               | money-f5rz     |
|                    |   sync 30s    | .onrender.com  |
| Electron           | <----------->  | PostgreSQL     |
| Frontend (Vite)    |   se ON       |                |
| Backend embarcado  |               +----------------+
| SQLite local       |
+--------------------+
```

- **Banco padrão:** SQLite local em `userData/SoftHair/database/local.db`
- **Sync (opcional):** ativado pelo usuário em **Sistema > Sync Cloud**
- **Funcionamento offline:** 100% — só precisa da nuvem se quiser compartilhar entre PCs

## 1. Pré-requisitos

- Node.js 18+ (apenas para buildar o instalador, **não** para os usuários finais)
- npm 9+
- Sistema operacional para build: Linux/macOS/Windows

## 2. Instalação das dependências

```bash
cd /home/ogejota/Documentos/SOFTHAIR/MONEY/SoftHair

# Instala deps do projeto raiz, backend embarcado e frontend
npm install
```

O `postinstall` cuida de instalar `backend/` e `frontend/`. Se algo falhar, rode manualmente:

```bash
cd backend && npm install
cd ../frontend && npm install
```

## 3. Rodar em desenvolvimento

Três terminais (ou use `concurrently`):

```bash
# Terminal 1: backend embarcado
cd SoftHair/backend && npm run dev

# Terminal 2: frontend Vite
cd SoftHair/frontend && npm run dev

# Terminal 3: Electron
cd SoftHair && npm run dev
```

Login padrão:
Configurar via env vars antes do primeiro start:
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`

> Sem env vars setadas, server NÃO cria admin em produção (proteção).
> Nunca commitar credenciais reais. Trocar senha após primeiro login.

## 4. Gerar instalador para os PCs do salão

```bash
cd /home/ogejota/Documentos/SOFTHAIR/MONEY/SoftHair

# Build do frontend + empacotamento Electron
npm run dist
```

Saída em `SoftHair/dist-electron/`:

| Plataforma | Artefato |
|------------|----------|
| Windows    | `SoftHair Setup x.x.x.exe` (NSIS installer) |
| Linux      | `SoftHair-x.x.x.AppImage` |
| macOS      | `SoftHair-x.x.x.dmg` |

Para gerar apenas Windows:

```bash
npm run build:win
```

Para gerar apenas Linux:

```bash
npm run build:linux
```

## 5. Instalar nos PCs do salão

### Windows
1. Copie `SoftHair Setup x.x.x.exe` para o PC
2. Execute como administrador
3. Siga o instalador (cria atalho na área de trabalho)
4. O banco SQLite é criado em `%APPDATA%/SoftHair/database/local.db` no primeiro start

### Linux
1. Copie o `.AppImage` para o PC
2. Dê permissão de execução: `chmod +x SoftHair-*.AppImage`
3. Execute com duplo-clique ou `./SoftHair-x.x.x.AppImage`
4. Banco em `~/.config/SoftHair/database/local.db`

### macOS
1. Abra o `.dmg`
2. Arraste SoftHair.app para `Applications`
3. Banco em `~/Library/Application Support/SoftHair/database/local.db`

## 6. Ativar sincronização com o Render

Por default o app funciona 100% local. Para sincronizar entre vários PCs:

1. Abra **Sistema > Sync Cloud** no app
2. Confira a URL do cloud (default: `https://money-f5rz.onrender.com/api`)
3. Escolha:
   - **Login no Cloud** (recomendado): digite email/senha cadastrados no servidor Render
   - **Usar Token**: cole um JWT gerado externamente
4. O app salva o token localmente e ativa o toggle automaticamente
5. A partir daí, a cada 30s o app envia mudanças locais e recebe mudanças remotas

### Desativar sync
Basta clicar no toggle ON/OFF na mesma tela. O banco local continua funcionando normalmente.

### Forçar sincronização manual
Botão **"Sincronizar Agora"** na mesma tela.

## 7. Localização dos dados

| Item | Caminho (Windows) | Caminho (Linux) | Caminho (macOS) |
|------|-------------------|------------------|------------------|
| Banco SQLite | `%APPDATA%/SoftHair/database/local.db` | `~/.config/SoftHair/database/local.db` | `~/Library/Application Support/SoftHair/database/local.db` |
| Config sync | `…/SoftHair/database/sync-config.json` | idem | idem |
| Logs | console do Electron | idem | idem |

**Backup recomendado:** copie o `local.db` periodicamente. Use o botão de backup na UI ou um agendamento de S.O.

## 8. Variáveis de ambiente (opcional)

Para desenvolvedores que querem customizar, criar arquivo `.env` em `SoftHair/backend/`:

```
PORT=3001
HOST=127.0.0.1
DATABASE_TYPE=sqlite
JWT_SECRET=<gera com: openssl rand -hex 32>
JWT_EXPIRES_IN=30d
SOFTHAIR_DEFAULT_ADMIN_EMAIL=<REDACTED_EMAIL>
SOFTHAIR_DEFAULT_ADMIN_PASSWORD=<REDACTED_PASSWORD>
SYNC_INTERVAL_MS=30000
```

Para usar PostgreSQL ao invés de SQLite (raro, geralmente só em dev):

```
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://user:pass@host:5432/db
DATABASE_SSL=true
```

## 9. Problemas comuns

| Sintoma | Solução |
|---------|---------|
| `EADDRINUSE: port 3001` | Outro app usa 3001. Mude `PORT` no .env do backend |
| `better-sqlite3 module not found` | Rode `npm rebuild better-sqlite3` em `backend/` |
| Sync falha com 401 | Token expirou — refaça o login no cloud |
| Sync falha com timeout | Sem internet ou Render dormindo (acorda em ~30s) |
| Backend não sobe no app empacotado | Verifique se `asarUnpack` inclui better-sqlite3 |

## 10. Arquitetura técnica

- **Electron main process** (`electron/main.js`): faz fork do backend e abre a BrowserWindow
- **Backend embarcado** (`backend/src/server.js`): Express + SQLite ou PostgreSQL via adapter
- **Frontend** (`frontend/`): Vite + React + TailwindCSS, build estático carregado por `file://`
- **Comunicação**: HTTP localhost (não usa IPC porque permite reusar o frontend web)
- **Sync** (`backend/src/services/syncService.js`): polling a cada 30s, push+pull baseado em `updated_at`

## Suporte

Issues e dúvidas: abra ticket no repo `guijoioj/SoftHair`.
