# CLAUDE.md — SoftHair (Desktop)

> Você está no repositório **DESKTOP** do ecossistema SoftHair.
> Este arquivo herda automaticamente as regras do `MONEY\CLAUDE.md` (umbrella).

## Escopo deste repo

Aplicação desktop do SoftHair: **Electron** empacotando uma SPA React (`frontend/`) + um backend Node/Express embarcado (`backend/`). Usado por donos e administradores do salão.

```
SoftHair\
├── backend\                # Node.js + Express + PostgreSQL
├── frontend\               # React 18 + Vite + Tailwind + React Query
├── electron\               # Wrapper Electron
├── docs\
│   └── knowledge-graph\    ← VAULT (segundo cérebro do ecossistema)
└── hermes\                 # (recursos auxiliares)
```

## Regra obrigatória antes de mexer em código

1. Leia `docs\knowledge-graph\CLAUDE.md` integralmente.
2. Siga a ordem: `HOME.md` → `AI-CONTEXT.md` → `domains\<x>` → `concepts\<x>` → arquivo-fonte.
3. Cite as notas consultadas ao propor mudanças.

## Mapa do vault relevante a este repo

- `domains\auth`, `domains\agendamentos`, `domains\clientes`, `domains\vendas`, `domains\produtos`, `domains\profissionais`, `domains\saloes`, `domains\servicos`, `domains\database`, `domains\security`, `domains\state`
- Arquivos-fonte mapeados em `desktop\backend\`, `desktop\frontend\`, `desktop\config\`, `desktop\root\`, `desktop\entities\` (no vault)

## Comandos de dev

```bash
# Backend
cd C:\Users\guise\Documents\MONEY\SoftHair\backend && npm run dev

# Frontend
cd C:\Users\guise\Documents\MONEY\SoftHair\frontend && npm run dev
```

## Stack específica

- **Backend**: Node.js, Express, PostgreSQL (`pg`), JWT + bcrypt, express-validator, multer, nodemailer, googleapis, ws.
- **Frontend**: React 18, Vite, TailwindCSS, TanStack React Query, axios, react-router-dom, recharts, lucide-react.
- **Container**: Electron.

## Convenções (resumo — detalhe completo no umbrella)

- Backend: async/await, try/catch em toda rota, JSON `{success, data|error}`, transações em ops multi-tabela.
- Frontend: componentes funcionais, React Query pra todo state de servidor, services/ pra HTTP, sem estilo inline.
