# Graph Report - src  (2026-04-29)

## Corpus Check
- Corpus is ~30,905 words - fits in a single context window. You may not need a graph.

## Summary
- 382 nodes · 563 edges · 49 communities detected
- Extraction: 60% EXTRACTED · 40% INFERRED · 0% AMBIGUOUS · INFERRED: 226 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]

## God Nodes (most connected - your core abstractions)
1. `query()` - 87 edges
2. `queryOne()` - 63 edges
3. `queryRun()` - 20 edges
4. `Helpers` - 18 edges
5. `WebSocketService` - 11 edges
6. `BaseModel` - 10 edges
7. `AuthService` - 10 edges
8. `Produto` - 9 edges
9. `Agendamento` - 8 edges
10. `CreditoCliente` - 8 edges

## Surprising Connections (you probably didn't know these)
- `runMigrations()` --calls--> `query()`  [INFERRED]
  src/config/initDb.js → src/config/database.js
- `createTables()` --calls--> `query()`  [INFERRED]
  src/config/initDb.js → src/config/database.js
- `createIndexes()` --calls--> `query()`  [INFERRED]
  src/config/initDb.js → src/config/database.js
- `createFunctions()` --calls--> `query()`  [INFERRED]
  src/config/initDb.js → src/config/database.js
- `healthCheck()` --calls--> `query()`  [INFERRED]
  src/scripts/health-check.js → src/config/database.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (13): Agendamento, Comissao, query(), withTransaction(), healthCheck(), healthCheck(), ensureMigrationsTable(), getExecutedMigrations() (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (11): resolverCliente(), resolverOuCriarCliente(), ClienteService, decrypt(), encrypt(), hashSensitive(), resolverOuCriarCliente(), resolverOuCriarCliente() (+3 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (8): AgendamentoService, AtendimentoService, BaseModel, BootstrapService, ComissaoService, queryOne(), NotificacaoService, Salao

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (5): ClienteHistorico, ComissaoEstorno, ComissaoPaga, queryRun(), PedidoAgendamento

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (4): BackupService, CreditoService, FechamentoService, VendaService

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (2): CreditoCliente, WebSocketService

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (9): createAdmin(), createDatabase(), createDefaultAdmin(), createFunctions(), createIndexes(), createTables(), initDb(), runMigrations() (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (1): Helpers

### Community 8 - "Community 8"
Cohesion: 0.21
Nodes (3): authMiddleware(), optionalAuth(), AuthService

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (1): Cliente

### Community 10 - "Community 10"
Cohesion: 0.25
Nodes (1): Profissional

### Community 11 - "Community 11"
Cohesion: 0.25
Nodes (1): Venda

### Community 12 - "Community 12"
Cohesion: 0.29
Nodes (1): Atendimento

### Community 13 - "Community 13"
Cohesion: 0.4
Nodes (1): ClienteApp

### Community 14 - "Community 14"
Cohesion: 0.4
Nodes (1): PedidoLoja

### Community 15 - "Community 15"
Cohesion: 0.4
Nodes (1): PontoRegistro

### Community 16 - "Community 16"
Cohesion: 0.6
Nodes (1): EmailService

### Community 17 - "Community 17"
Cohesion: 0.67
Nodes (2): backup(), limparBackupsAntigos()

### Community 18 - "Community 18"
Cohesion: 0.67
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 19`** (2 nodes): `gracefulShutdown()`, `server.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `validate.js`, `validate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `clienteAuthMiddleware()`, `clienteAuth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `profissionalAuthMiddleware()`, `profissionalAuth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `signToken()`, `appAuth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `signToken()`, `appProfissionalAuth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `checkProfissional()`, `profissional.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `restoreBackup()`, `restore.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `atendimentos.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `auth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `backup.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `comissoes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `configuracoes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `creditos.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `fechamentos.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `health.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `historico.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `notificacoes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `vendas.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `saloes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `appProfissional.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `clientes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `servicos.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (1 nodes): `profissionais.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (1 nodes): `produtos.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `agendamentos.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `auth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `security.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `query()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 14`, `Community 15`?**
  _High betweenness centrality (0.429) - this node is a cross-community bridge._
- **Why does `queryOne()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 15`?**
  _High betweenness centrality (0.287) - this node is a cross-community bridge._
- **Why does `queryRun()` connect `Community 3` to `Community 0`, `Community 1`, `Community 2`, `Community 5`, `Community 13`, `Community 14`, `Community 15`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Are the 83 inferred relationships involving `query()` (e.g. with `createTables()` and `createIndexes()`) actually correct?**
  _`query()` has 83 INFERRED edges - model-reasoned connections that need verification._
- **Are the 61 inferred relationships involving `queryOne()` (e.g. with `.verificarConflito()` and `.atualizarStatus()`) actually correct?**
  _`queryOne()` has 61 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `queryRun()` (e.g. with `.create()` and `.update()`) actually correct?**
  _`queryRun()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._