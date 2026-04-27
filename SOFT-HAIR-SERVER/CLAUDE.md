# CLAUDE.md — SOFT-HAIR-SERVER

> Você está no repositório **SERVER** (API standalone) do ecossistema SoftHair.
> Este arquivo herda automaticamente as regras do `MONEY\CLAUDE.md` (umbrella).

## Escopo deste repo

API HTTP standalone do SoftHair: serve o app mobile e integrações externas. Backend Node/Express + PostgreSQL, separado do backend embarcado do desktop.

```
SOFT-HAIR-SERVER\
├── src\
│   ├── routes\             # Endpoints HTTP
│   ├── models\             # Models (BaseModel pattern)
│   ├── services\           # Lógica de negócio
│   ├── middleware\         # Auth, CORS, validação
│   ├── config\             # initDb, pool, env
│   └── server.js
├── tools\                  # Scripts utilitários
├── docs\
├── migrate.js              # Migrações de schema
└── package.json
```

## Regra obrigatória antes de mexer em código

O vault vive em `..\SoftHair\docs\knowledge-graph\`. Caminho absoluto:
`C:\Users\guise\Documents\MONEY\SoftHair\docs\knowledge-graph`

1. Leia `knowledge-graph\CLAUDE.md` integralmente.
2. Siga a ordem: `AI-CONTEXT.md` → `domains\<x>` → `concepts\<x>` → arquivo-fonte.
3. Cite as notas consultadas ao propor mudanças.

## Mapa do vault relevante a este repo

- `domains\api`, `domains\auth`, `domains\security`, `domains\database`, `domains\sync`, `domains\agendamentos`, `domains\clientes`, `domains\vendas`, `domains\produtos`, `domains\profissionais`, `domains\saloes`, `domains\servicos`
- Arquivos-fonte mapeados em `server\routes\`, `server\models\`, `server\services\`, `server\config\`, `server\root\`, `server\entities\` (no vault)
- Entradas-fonte importantes:
  - `src\server.js` ↔ `[[server/root/src-serverjs]]`
  - `src\routes\auth.js` ↔ `[[server/routes/src-routes-authjs]]`
  - `src\config\initDb.js` ↔ `[[server/config/src-config-initdbjs]]`

## Comandos de dev

```bash
cd C:\Users\guise\Documents\MONEY\SOFT-HAIR-SERVER && npm run dev

# Migração de schema
node migrate.js
```

## Stack específica

- Node.js, Express
- PostgreSQL (com `pool` + `BaseModel` pattern)
- JWT + HMAC signatures
- express-validator
- CORS configurado pra origens do desktop e mobile

## Convenções (resumo — detalhe completo no umbrella)

- async/await em todo handler.
- try/catch com resposta JSON consistente: `{success, data|error}`.
- `authMiddleware` em rotas autenticadas; `optionalAuth` em rotas públicas com identificação opcional.
- Validar inputs com `express-validator` em todo POST/PUT.
- Transações pra operações multi-tabela.
- Nunca expor `password`, tokens ou secrets em resposta.
