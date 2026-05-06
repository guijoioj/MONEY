# Graph Report - src  (2026-05-02)

## Corpus Check
- Corpus is ~33,738 words - fits in a single context window. You may not need a graph.

## Summary
- 423 nodes · 624 edges · 54 communities detected
- Extraction: 63% EXTRACTED · 37% INFERRED · 0% AMBIGUOUS · INFERRED: 232 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Atendimento  .constructor()|Atendimento / .constructor()]]
- [[_COMMUNITY_resolverCliente()  resolverOuCriarCliente()|resolverCliente() / resolverOuCriarCliente()]]
- [[_COMMUNITY_AgendamentoService  .atualizar()|AgendamentoService / .atualizar()]]
- [[_COMMUNITY_.registerSalao()  BackupService|.registerSalao() / BackupService]]
- [[_COMMUNITY_authMiddleware()  optionalAuth()|authMiddleware() / optionalAuth()]]
- [[_COMMUNITY_ClienteApp  .create()|ClienteApp / .create()]]
- [[_COMMUNITY_Helpers  .formatCPF()|Helpers / .formatCPF()]]
- [[_COMMUNITY_.delete()  websocketService.js|.delete() / websocketService.js]]
- [[_COMMUNITY_Agendamento  .atualizarStatus()|Agendamento / .atualizarStatus()]]
- [[_COMMUNITY_BaseModel  .constructor()|BaseModel / .constructor()]]
- [[_COMMUNITY_dateOnly()  PedidoAgendamento|dateOnly() / PedidoAgendamento]]
- [[_COMMUNITY_createDatabase()  createDefaultAdmin()|createDatabase() / createDefaultAdmin()]]
- [[_COMMUNITY_CreditoCliente  .create()|CreditoCliente / .create()]]
- [[_COMMUNITY_Comissao  .constructor()|Comissao / .constructor()]]
- [[_COMMUNITY_Profissional  .buscarAtivosPorSalao()|Profissional / .buscarAtivosPorSalao()]]
- [[_COMMUNITY_PedidoLoja  .atualizarStatus()|PedidoLoja / .atualizarStatus()]]
- [[_COMMUNITY_ClienteHistorico  .create()|ClienteHistorico / .create()]]
- [[_COMMUNITY_EmailService  .getTransporter()|EmailService / .getTransporter()]]
- [[_COMMUNITY_SecurityInitService  .createDefaultAdmin()|SecurityInitService / .createDefaultAdmin()]]
- [[_COMMUNITY_appAuthMiddleware()  getBearerToken()|appAuthMiddleware() / getBearerToken()]]
- [[_COMMUNITY_backup()  limparBackupsAntigos()|backup() / limparBackupsAntigos()]]
- [[_COMMUNITY_sync.js  isAllowedTable()|sync.js / isAllowedTable()]]
- [[_COMMUNITY_gracefulShutdown()  server.js|gracefulShutdown() / server.js]]
- [[_COMMUNITY_validate.js  validate()|validate.js / validate()]]
- [[_COMMUNITY_clienteAuthMiddleware()  clienteAuth.js|clienteAuthMiddleware() / clienteAuth.js]]
- [[_COMMUNITY_profissionalAuthMiddleware()  profissionalAuth.js|profissionalAuthMiddleware() / profissionalAuth.js]]
- [[_COMMUNITY_signToken()  appAuth.js|signToken() / appAuth.js]]
- [[_COMMUNITY_signToken()  appProfissionalAuth.js|signToken() / appProfissionalAuth.js]]
- [[_COMMUNITY_signClienteToken()  auth.js|signClienteToken() / auth.js]]
- [[_COMMUNITY_restoreBackup()  restore.js|restoreBackup() / restore.js]]
- [[_COMMUNITY_static.test.js  listJsFiles()|static.test.js / listJsFiles()]]
- [[_COMMUNITY_index.js|index.js]]
- [[_COMMUNITY_User.js|User.js]]
- [[_COMMUNITY_atendimentos.js|atendimentos.js]]
- [[_COMMUNITY_auth.js|auth.js]]
- [[_COMMUNITY_backup.js|backup.js]]
- [[_COMMUNITY_comissoes.js|comissoes.js]]
- [[_COMMUNITY_configuracoes.js|configuracoes.js]]
- [[_COMMUNITY_creditos.js|creditos.js]]
- [[_COMMUNITY_fechamentos.js|fechamentos.js]]
- [[_COMMUNITY_health.js|health.js]]
- [[_COMMUNITY_historico.js|historico.js]]
- [[_COMMUNITY_notificacoes.js|notificacoes.js]]
- [[_COMMUNITY_vendas.js|vendas.js]]
- [[_COMMUNITY_saloes.js|saloes.js]]
- [[_COMMUNITY_appProfissional.js|appProfissional.js]]
- [[_COMMUNITY_clientes.js|clientes.js]]
- [[_COMMUNITY_servicos.js|servicos.js]]
- [[_COMMUNITY_profissionais.js|profissionais.js]]
- [[_COMMUNITY_produtos.js|produtos.js]]
- [[_COMMUNITY_agendamentos.js|agendamentos.js]]
- [[_COMMUNITY_security.js|security.js]]
- [[_COMMUNITY_profissional.js|profissional.js]]
- [[_COMMUNITY_index.js|index.js]]

## God Nodes (most connected - your core abstractions)
1. `query()` - 99 edges
2. `queryOne()` - 74 edges
3. `Helpers` - 18 edges
4. `WebSocketService` - 14 edges
5. `Agendamento` - 12 edges
6. `BaseModel` - 12 edges
7. `Produto` - 10 edges
8. `Venda` - 10 edges
9. `AuthService` - 10 edges
10. `Cliente` - 9 edges

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

### Community 0 - "Atendimento / .constructor()"
Cohesion: 0.04
Nodes (16): Atendimento, Cliente, query(), queryRun(), withTransaction(), healthCheck(), healthCheck(), cleanupSmokeData() (+8 more)

### Community 1 - "resolverCliente() / resolverOuCriarCliente()"
Cohesion: 0.06
Nodes (12): resolverCliente(), resolverOuCriarCliente(), ClienteService, ComissaoEstorno, decrypt(), encrypt(), hashSensitive(), resolverOuCriarCliente() (+4 more)

### Community 2 - "AgendamentoService / .atualizar()"
Cohesion: 0.05
Nodes (8): AgendamentoService, AtendimentoService, ComissaoPaga, ComissaoService, queryOne(), Fechamento, NotificacaoService, PontoRegistro

### Community 3 - ".registerSalao() / BackupService"
Cohesion: 0.06
Nodes (5): BackupService, CreditoService, FechamentoService, Venda, VendaService

### Community 4 - "authMiddleware() / optionalAuth()"
Cohesion: 0.13
Nodes (4): authMiddleware(), optionalAuth(), AuthService, SecurityService

### Community 5 - "ClienteApp / .create()"
Cohesion: 0.13
Nodes (3): ClienteApp, createAdmin(), Salao

### Community 6 - "Helpers / .formatCPF()"
Cohesion: 0.11
Nodes (1): Helpers

### Community 7 - ".delete() / websocketService.js"
Cohesion: 0.18
Nodes (1): WebSocketService

### Community 8 - "Agendamento / .atualizarStatus()"
Cohesion: 0.18
Nodes (1): Agendamento

### Community 9 - "BaseModel / .constructor()"
Cohesion: 0.32
Nodes (1): BaseModel

### Community 10 - "dateOnly() / PedidoAgendamento"
Cohesion: 0.31
Nodes (3): dateOnly(), PedidoAgendamento, toShape()

### Community 11 - "createDatabase() / createDefaultAdmin()"
Cohesion: 0.33
Nodes (7): createDatabase(), createDefaultAdmin(), createFunctions(), createIndexes(), createTables(), initDb(), runMigrations()

### Community 12 - "CreditoCliente / .create()"
Cohesion: 0.28
Nodes (1): CreditoCliente

### Community 13 - "Comissao / .constructor()"
Cohesion: 0.25
Nodes (1): Comissao

### Community 14 - "Profissional / .buscarAtivosPorSalao()"
Cohesion: 0.25
Nodes (1): Profissional

### Community 15 - "PedidoLoja / .atualizarStatus()"
Cohesion: 0.36
Nodes (2): PedidoLoja, toShape()

### Community 16 - "ClienteHistorico / .create()"
Cohesion: 0.29
Nodes (1): ClienteHistorico

### Community 17 - "EmailService / .getTransporter()"
Cohesion: 0.6
Nodes (1): EmailService

### Community 18 - "SecurityInitService / .createDefaultAdmin()"
Cohesion: 0.6
Nodes (1): SecurityInitService

### Community 19 - "appAuthMiddleware() / getBearerToken()"
Cohesion: 0.83
Nodes (3): appAuthMiddleware(), getBearerToken(), profissionalAppMiddleware()

### Community 20 - "backup() / limparBackupsAntigos()"
Cohesion: 0.67
Nodes (2): backup(), limparBackupsAntigos()

### Community 21 - "sync.js / isAllowedTable()"
Cohesion: 0.67
Nodes (0): 

### Community 22 - "gracefulShutdown() / server.js"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "validate.js / validate()"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "clienteAuthMiddleware() / clienteAuth.js"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "profissionalAuthMiddleware() / profissionalAuth.js"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "signToken() / appAuth.js"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "signToken() / appProfissionalAuth.js"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "signClienteToken() / auth.js"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "restoreBackup() / restore.js"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "static.test.js / listJsFiles()"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "index.js"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "User.js"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "atendimentos.js"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "auth.js"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "backup.js"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "comissoes.js"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "configuracoes.js"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "creditos.js"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "fechamentos.js"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "health.js"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "historico.js"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "notificacoes.js"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "vendas.js"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "saloes.js"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "appProfissional.js"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "clientes.js"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "servicos.js"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "profissionais.js"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "produtos.js"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "agendamentos.js"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "security.js"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "profissional.js"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "index.js"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `gracefulShutdown() / server.js`** (2 nodes): `gracefulShutdown()`, `server.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `validate.js / validate()`** (2 nodes): `validate.js`, `validate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `clienteAuthMiddleware() / clienteAuth.js`** (2 nodes): `clienteAuthMiddleware()`, `clienteAuth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `profissionalAuthMiddleware() / profissionalAuth.js`** (2 nodes): `profissionalAuthMiddleware()`, `profissionalAuth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `signToken() / appAuth.js`** (2 nodes): `signToken()`, `appAuth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `signToken() / appProfissionalAuth.js`** (2 nodes): `signToken()`, `appProfissionalAuth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `signClienteToken() / auth.js`** (2 nodes): `signClienteToken()`, `auth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `restoreBackup() / restore.js`** (2 nodes): `restoreBackup()`, `restore.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `static.test.js / listJsFiles()`** (2 nodes): `static.test.js`, `listJsFiles()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `index.js`** (1 nodes): `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `User.js`** (1 nodes): `User.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `atendimentos.js`** (1 nodes): `atendimentos.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `auth.js`** (1 nodes): `auth.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `backup.js`** (1 nodes): `backup.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `comissoes.js`** (1 nodes): `comissoes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `configuracoes.js`** (1 nodes): `configuracoes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `creditos.js`** (1 nodes): `creditos.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `fechamentos.js`** (1 nodes): `fechamentos.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `health.js`** (1 nodes): `health.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `historico.js`** (1 nodes): `historico.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `notificacoes.js`** (1 nodes): `notificacoes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `vendas.js`** (1 nodes): `vendas.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `saloes.js`** (1 nodes): `saloes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `appProfissional.js`** (1 nodes): `appProfissional.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `clientes.js`** (1 nodes): `clientes.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `servicos.js`** (1 nodes): `servicos.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `profissionais.js`** (1 nodes): `profissionais.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `produtos.js`** (1 nodes): `produtos.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `agendamentos.js`** (1 nodes): `agendamentos.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `security.js`** (1 nodes): `security.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `profissional.js`** (1 nodes): `profissional.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `index.js`** (1 nodes): `index.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `query()` connect `Atendimento / .constructor()` to `resolverCliente() / resolverOuCriarCliente()`, `AgendamentoService / .atualizar()`, `.registerSalao() / BackupService`, `authMiddleware() / optionalAuth()`, `ClienteApp / .create()`, `.delete() / websocketService.js`, `Agendamento / .atualizarStatus()`, `BaseModel / .constructor()`, `dateOnly() / PedidoAgendamento`, `createDatabase() / createDefaultAdmin()`, `CreditoCliente / .create()`, `Comissao / .constructor()`, `Profissional / .buscarAtivosPorSalao()`, `PedidoLoja / .atualizarStatus()`, `ClienteHistorico / .create()`, `SecurityInitService / .createDefaultAdmin()`?**
  _High betweenness centrality (0.447) - this node is a cross-community bridge._
- **Why does `queryOne()` connect `AgendamentoService / .atualizar()` to `Atendimento / .constructor()`, `resolverCliente() / resolverOuCriarCliente()`, `.registerSalao() / BackupService`, `authMiddleware() / optionalAuth()`, `ClienteApp / .create()`, `Agendamento / .atualizarStatus()`, `BaseModel / .constructor()`, `dateOnly() / PedidoAgendamento`, `CreditoCliente / .create()`, `Comissao / .constructor()`, `Profissional / .buscarAtivosPorSalao()`, `PedidoLoja / .atualizarStatus()`, `ClienteHistorico / .create()`?**
  _High betweenness centrality (0.376) - this node is a cross-community bridge._
- **Why does `Helpers` connect `Helpers / .formatCPF()` to `resolverCliente() / resolverOuCriarCliente()`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Are the 95 inferred relationships involving `query()` (e.g. with `createTables()` and `createIndexes()`) actually correct?**
  _`query()` has 95 INFERRED edges - model-reasoned connections that need verification._
- **Are the 72 inferred relationships involving `queryOne()` (e.g. with `.verificarConflito()` and `.atualizarStatus()`) actually correct?**
  _`queryOne()` has 72 INFERRED edges - model-reasoned connections that need verification._
- **Should `Atendimento / .constructor()` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `resolverCliente() / resolverOuCriarCliente()` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._