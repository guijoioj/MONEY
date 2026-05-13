# Sync — Schema Drift (SQLite local vs PostgreSQL cloud)

**P5-A4** documenta diferenças conhecidas entre o schema do backend embarcado
(SQLite, definido em `backend/src/config/initDb.js`) e o schema PostgreSQL do
SOFT-HAIR-SERVER (Render).

Esta divergência é **proposital** em alguns pontos (omitir campos sensíveis) e
**dívida técnica** em outros (campos novos no cloud sem migration local).

## Campos propositalmente OMITIDOS do sync

| Tabela | Campo | Razão |
|---|---|---|
| profissionais | `senha_hash` | sync nunca propaga credentials; backend embarcado pode ter usuários diferentes |
| profissionais | `app_ativo` | flag local do app mobile separado |

## Campos PostgreSQL-only (não existem em SQLite local)

Sync silenciosamente descarta esses campos via `TABLE_COLUMNS` allowlist em
`syncService.js`. Push de SQLite local não envia, pull do cloud sanitiza.

| Tabela | Campo | Tipo cloud | Status |
|---|---|---|---|
| agendamentos | `cancelled_by_user_id` | INTEGER | descartado |
| vendas | `valor_credito_usado` | REAL | descartado |
| clientes | (nenhum extra confirmado) | — | — |

## Tabelas PostgreSQL-only

Estas tabelas existem no cloud (via `migrate.js`) mas NÃO existem em SQLite
local — sync ignora completamente (não em `SYNC_TABLES`).

- `notificacoes` — push notifications do mobile
- `comissoes_pagas` — fluxo financeiro avançado (Pass 5: cálculo local via `comissoes` route, sem persistência)
- `fechamentos` — fechamentos mensais persistidos
- `despesas` — Pass 5 implementou local; sync futuro
- `creditos` — créditos de cliente
- `historico` — histórico agregado de cliente
- `bloqueios` — bloqueios de horário na agenda
- `configuracoes` — k/v de configuração do salão

## Estratégia para resolver drift

1. **Curto prazo** (Pass 5): este documento + sync conflict detection (P5-C4)
   captura overwrites silenciosos quando local e remoto divergem.
2. **Médio prazo**: harmonizar `clientes`, `agendamentos`, `vendas`, `produtos`,
   `servicos`, `atendimentos`, `profissionais` — adicionar migrations em
   `SoftHair/backend/src/migrations/` para colunas Postgres-only.
3. **Longo prazo**: incluir `notificacoes`, `despesas`, `creditos` em `SYNC_TABLES`
   após implementar localmente.

## Mecanismo de detecção runtime

Se um pull receber payload com campos desconhecidos, `sanitizeRow()` os
silenciosamente descarta. Para detectar drift novo:

```js
// Adicionar em syncService.js applyRemoteChanges (P5-A4 instrumentation):
for (const k of Object.keys(row)) {
  if (!TABLE_COLUMNS[table].includes(k)) {
    console.warn(`[sync drift] coluna desconhecida ${table}.${k} no payload remoto`);
  }
}
```

Pass 5 inclui a documentação. A instrumentação fica como TODO para Pass 6
(adicionar metric counter agregado em vez de log spam).

## Conflito intencional vs dívida

- **OK intencional**: `senha_hash` / `app_ativo` permanecem omitidos para
  sempre. Documentar mas não "corrigir".
- **Dívida**: `cancelled_by_user_id`, `valor_credito_usado` e tabelas
  `notificacoes/comissoes_pagas/fechamentos/...` exigem migration local
  + ampliação de `SYNC_TABLES` + `TABLE_COLUMNS`.

## Última revisão

2026-05-13 · Pass 5 audit.
