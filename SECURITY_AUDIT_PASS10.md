# Security Audit Pass 10 — SoftHair (FINAL)

**Data:** 2026-05-11
**Auditor:** Pass 10 (décima passada, após os 3 fixes do Pass 9 aplicados no commit `9ae4bee`).
**Escopo:** SOFT-HAIR-SERVER. Foco: convergência final. Verificação dos fixes Pass 9, varredura completa restante da família "state machine ausente", operações em lote (bulk), WebSocket lifecycle, reconnect attacks, push token storage growth, API key lifecycle, cross-feature interaction (LGPD/cliente delete/audit), audit log chain hash integrity.
**Tipo:** Defensiva — análise estática + execução de testes (9/9 PASS).
**Resultado:** **1 issue NOVO encontrado (médio) — família "state machine ausente" ainda não totalmente fechada.** Os 3 fixes do Pass 9 estão verificados como aplicados. Surface inicialmente prevista como convergência total foi adiada por uma 4ª instância localizada em rotas legacy do app profissional (`appProfissional.js`) — bypass do state machine via raw UPDATE.

---

## Verificação dos fixes Pass 9

| Issue | Status real | Notas |
|---|---|---|
| P9-A1 `agendamentos.atualizar` state machine + requireAdmin | ✅ Aplicado em `src/services/AgendamentoService.js:1-19,146-237` e `src/routes/agendamentos.js:131-178`. State machine `AGEND_STATUS_TRANSITIONS` declarada (`agendado → confirmado/cancelado/concluido/no_show`; `confirmado → concluido/cancelado/no_show`; `concluido` terminal; `cancelado → agendado` permite re-agendar; `no_show` terminal). PUT exige `requireAdmin`. Validator `body('status').isIn([...])` aplicado. Re-overlap-check quando `data_hora`/`profissional_id` mudaram OU quando status sai de `cancelado` → `agendado` (re-ativação). `logAction` persistente em `agendamento.status_change` com before/after. Erro de transição inválida ou conflito retorna 400. |
| P9-M1 `PedidoLoja.atualizarStatus` state machine | ✅ Aplicado em `src/models/PedidoLoja.js:1-18,127-167` e `src/routes/app/loja.js:148-186`. State machine `PEDIDO_STATUS_TRANSITIONS` (pendente → confirmado/cancelado; confirmado → preparando/cancelado; preparando → enviado/cancelado; enviado → entregue; entregue/cancelado terminais). Errors lançados com `err.code` (`INVALID_TRANSITION`, `INVALID_STATUS`, `NOT_FOUND`) mapeados para 400/404 no route. `logAction` em `pedido_loja.status_change` com before/after. |
| P9-M2 `fechamentos.gerar` validação de período | ✅ Aplicado em `src/routes/fechamentos.js:62-91`. `body('data_fim').custom()` valida ordem (`data_fim >= data_inicio`), período máximo 365 dias, e `data_fim <= fim do dia atual`. Mensagens claras (`data_fim deve ser >= data_inicio`, `Período máximo: 365 dias`, `data_fim não pode estar no futuro`). Test harness atualizado (`integration.smoke.test.js:341-354`) para usar período passado realista (30 dias atrás → ontem). |

**Verificação independente:** suíte Jest rodada após os 3 fixes — **9/9 PASS** (smoke 1 + static 2 + pass7 6). Pass7-T6 (race de abrir caixa) continua determinístico. Pré-condição mantida: `DATABASE_SSL=true` no environment.

---

## Novos issues encontrados (Pass 10)

### 🟡 MÉDIOS

#### [P10-M1] `appProfissional.iniciar/finalizar` faz UPDATE direto em `agendamentos.status` — bypass do state machine P9-A1

- **Arquivos:** `SOFT-HAIR-SERVER/src/routes/appProfissional.js:230-263,335-384`
- **Descrição:** As rotas `POST /api/app/profissional/atendimentos/:id/iniciar` e `POST /api/app/profissional/atendimentos/:id/finalizar` atualizam `agendamentos.status` via **raw UPDATE direto no pool** — não passam pelo `AgendamentoService.atualizar` (onde o state machine `AGEND_STATUS_TRANSITIONS` foi aplicado em P9-A1).
  - `POST /atendimentos/:id/iniciar`: `UPDATE agendamentos SET status = 'em_andamento' WHERE ... AND status <> 'em_andamento'`. Aceita transições de **qualquer status** (inclusive `cancelado`, `concluido`, `no_show`) para `em_andamento`.
  - `POST /atendimentos/:id/finalizar`: `UPDATE agendamentos SET status = 'finalizado' WHERE ... AND status <> 'finalizado'`. Mesmo problema — pode finalizar agendamento previamente `cancelado`.
  - **Vetor de fraude operacional:** profissional autenticado no app mobile chama `finalizar` em agendamento `cancelado` pelo cliente — agendamento "morto" vira `finalizado`, gera atendimento (linhas 359-364) e registro de ponto, e potencialmente comissão associada. Cliente vê push e histórico inconsistente.
  - **Vocabulário inconsistente:** a state machine P9-A1 usa `['agendado','confirmado','cancelado','concluido','no_show']`, mas as rotas profissional usam `'em_andamento'` e `'finalizado'`. Há divergência semântica em todo o codebase (também aparece em `relatorios.js`, `Cliente.js`, `Servico.js`). Antes de fechar a state machine, decisão de domínio é necessária: o estado `em_andamento` é status de **agendamento** ou de **atendimento**? Pela semântica, parece que **agendamentos** deveria conter `agendado → confirmado → em_andamento → finalizado/no_show/cancelado` e atendimentos seu próprio ciclo. Reconciliação de vocabulário é pré-requisito para fechar a state machine.
- **Impacto:** Fraude operacional média. Bypass do P9-A1 via rota paralela. Combinado com falta de audit log nessas rotas (`logAction` não é chamado em iniciar/finalizar), fica invisível em trilha forense.
- **Fix recomendado:**
  1. **Reconciliar vocabulário** de `agendamentos.status` em todo o codebase. Definir enum canônico (sugestão: `['agendado','confirmado','em_andamento','finalizado','cancelado','no_show']` — remove `concluido` substituindo por `finalizado`, OU mantém `concluido` e renomeia rotas profissional).
  2. Reescrever P9-A1 com o vocabulário canônico (incluir `em_andamento` e `finalizado`).
  3. Refatorar `iniciar`/`finalizar` para chamar `AgendamentoService.atualizar({ status: 'em_andamento' }, ...)` em vez de UPDATE direto — assim atravessa a state machine.
  4. Adicionar `logAction` em ambas as rotas (`agendamento.iniciar` / `agendamento.finalizar`) para auditoria.

---

## Áreas verificadas (e LIMPAS)

### Fixes de passes anteriores (sem regressão)
- ✅ **P8-A1 vendas state machine** (verificado novamente em P9, sem regressão)
- ✅ **P8-A2 atendimentos state machine** (verificado novamente em P9, sem regressão)
- ✅ **P8-M1 race caixa UNIQUE partial idx** (verificado em P9 — Pass7-T6 determinístico)
- ✅ **P9-A1 agendamentos state machine** (aplicado, com re-overlap-check + audit log)
- ✅ **P9-M1 pedidos_loja state machine** (aplicado, com errors estruturados + audit log)
- ✅ **P9-M2 fechamentos período válido** (aplicado, com test harness atualizado)

### Operações em lote (bulk)
- ✅ `POST /api/sync/push` (`routes/sync.js:140-160`): limite **100 changes** por requisição, transação serializável, `SET LOCAL statement_timeout = '10s'`, whitelist de tabelas (`isAllowedTable`), whitelist de operações (`['INSERT','UPDATE','DELETE']`), validação FK tenancy por change. Cada item validado individualmente.
- ✅ `POST /api/comissoes/pagar` (`routes/comissoes.js:55-133`): bulk de IDs — UPDATE idempotente com `pago=false` filter; profissional+salao tenancy validado; reconciliação `valorReal vs valor passado` com tolerância 1 centavo; audit log. Não é exploitable.
- ✅ `POST /api/app/loja/pedido` (`routes/app/loja.js:56-120`): cada item do array validado (`quantidade 1..10000`); preço server-side filtrado por `salao_id`; cross-tenant pricing bloqueado.

### WebSocket lifecycle e conexões persistentes
- ✅ **Cap de conexões por user** (`websocketService.js:9,74-80`): `WS_MAX_CONNECTIONS_PER_USER=5` (default). Bloqueia DoS de conexão.
- ✅ **maxPayload 64KB** (`websocketService.js:45`): mitiga DoS de mensagem grande.
- ✅ **Heartbeat 30s + timeout 45s** (`websocketService.js:5-6,138-148`): conexões mortas detectadas e `terminate()`-d. Não há memory leak.
- ✅ **removeClient em close/error** (`websocketService.js:124-131,343-351`): decrementa contagem de conexões e remove do Map. Sem leak.
- ✅ **MAX_SUBSCRIPTIONS=50 por conexão** (`websocketService.js:230-234`): mitiga memory bloat.
- ✅ **Origin validation** (`websocketService.js:53-61`): valida contra `ALLOWED_ORIGINS`; mobile (sem Origin) permitido via JWT.
- ✅ **JWT obrigatório no handshake** (`websocketService.js:67-71`): sem token, rejeita 4001. Sem fallback `auth via mensagem`.
- ✅ **algorithms HS256 travado** (`websocketService.js:73,199`): bloqueia alg confusion.
- ✅ **Tenancy de canal** (`websocketService.js:235-250`): cliente/profissional só pode subscrever próprio canal (`cliente:<id>`, `profissional:<id>`). Admin tem amplo acesso.
- ✅ **Chat tenancy** (`websocketService.js:284-308,326-340`): destinatário validado contra mesmo `salao_id` do remetente; delivery filter por salão.

### Reconnect attacks (cliente flapping)
- ✅ Cap de 5 conexões simultâneas por user (acima): cliente que fecha+reabre dentro do mesmo TCP RTT é absorvido sem explodir Map. **Não vai além disso** — não há rate-limit sobre `verifyClient` per-IP/per-token. Em teoria, um atacante com JWT válido pode bater no handshake repetidamente; cada handshake faz `jwt.verify` (CPU-bound). Mitigação atual: `MAX_CONNECTIONS_PER_USER=5`, então após 5 sockets simultâneos abertos, o atacante para de cravar — mas se ele fecha+reabre rápido, pode flutuar abaixo do cap. **Não é critical** porque `jwt.verify` é ~50µs e a única amplificação é CPU; rate-limit global do Express ainda se aplica. Nota: roadmap de defesa em profundidade — rate-limit por token no handshake.

### Storage growth attacks (push tokens, audit_log etc.)
- ✅ **push_token é coluna em clientes/profissionais (UPDATE, não INSERT)** (`initDb.js:555-556`, `appAuth.js:163-167`, `appProfissionalAuth.js:104-118`): 1 row por usuário; PUT substitui valor. Não cria rows novas — não há crescimento da tabela via push token spam.
  - ⚠️ Observação minor: `pushToken` não tem `isLength({ max: ... })`. Cliente malicioso poderia armazenar string de 100KB+. Não é DoS imediato (TEXT em Postgres TOAST automaticamente), mas pode degradar `SELECT push_token`. Sugestão de prática: validar `body('pushToken').isLength({ max: 512 })`.
- ✅ **audit_log retention** (`scripts/auditCleanup.js`): script manual com `--confirm=I_UNDERSTAND_AUDIT_RETENTION` e retention mínima 365 dias.
- ✅ **WebSocket subscriptions**: cap 50 por conexão (verificado acima).

### API key lifecycle
- ✅ **Criação**: `POST /api/auth/apikey` (`routes/auth.js:138-156`) com `requireAdmin`; gera key via `crypto.randomBytes(32).toString('hex')`; persiste em `api_keys` com `salao_id`, `permissoes`, `expires_at`.
- ✅ **Expiração**: `validateApiKey` em `services/authService.js:237-254` filtra `expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP` e `ativo = true`.
- ✅ **Last-use tracking**: `UPDATE api_keys SET ultimo_uso = CURRENT_TIMESTAMP` em cada validação.
- ⚠️ **Não há endpoint dedicado de revogação/rotação exposto** (DELETE /api/auth/apikey/:id, ou PUT /api/auth/apikey/:id/rotate). Admin precisa revogar via psql direto (`UPDATE api_keys SET ativo = false WHERE id = ...`). Não é vulnerabilidade — é gap de UX/manageability. Sugestão de prática: expor `DELETE /api/auth/apikey/:id` com audit log + `POST /api/auth/apikey/:id/rotate`.

### Cross-feature interaction: cliente delete + audit log + LGPD
- ✅ **LGPD delete** (`routes/appAuth.js:173-244`): cliente envia `confirmacao: 'EXCLUIR_MEUS_DADOS'`; UPDATE anonimiza PII (`nome='Cliente Removido'`, `email/telefone/cpf/endereco/foto_url/push_token/observacoes/senha_hash/data_nascimento` → NULL); seta `app_ativo=false` e `ativo=false`; preserva histórico (agendamentos, vendas) para compliance fiscal BR.
- ✅ **Audit log do delete**: `logAction({action: 'cliente.lgpd_delete', actorType:'cliente', actorId: req.clienteId})`. Não passa `before` snapshot — portanto não vaza PII no audit_log queryable.
- ✅ **JWT revogado**: `AuthService.revokeToken(token)` adiciona JTI à blacklist.
- ✅ **Cache invalidado**: `invalidateClienteCache(req.clienteId)` fecha janela de 2min do TTL em que `app_ativo` cacheado ainda poderia ser true.
- ✅ **Middleware bloqueia anonimizado** (`middleware/clienteAuth.js:51`): após anonimização, qualquer JWT futuro bate no check "Bloquear se cliente foi anonimizado/desativado".
- ✅ **Sanitização em audit_log** (`utils/auditLog.js:7-28`): chaves sensíveis (`senha_hash`, `push_token`, `jwt`, `api_key`, etc.) redactadas via `redactSensitive` antes de persistir em `before_data`/`after_data`. Funciona em profundidade de até 6 níveis aninhados.

### Integridade dos audit logs (chain hash)
- ✅ **Hash chain trigger BEFORE INSERT** (`initDb.js:705-736`): calcula `current_hash = sha256(previous_hash || canonical_row)` onde `canonical_row` inclui `salao_id|actor_id|actor_type|action|entity_type|entity_id|before_data|after_data|ip|user_agent`. **Coluna `created_at` NÃO está no canonical** — isso é OK porque o trigger é BEFORE INSERT e Postgres preenche `created_at` antes; mas o hash NÃO depende dela. Verificável em Pass7-T1.
- ✅ **Append-only triggers BEFORE UPDATE/DELETE** (`initDb.js:681-704`): `RAISE EXCEPTION 'audit_log é append-only'`.
- ✅ **pgcrypto extension** (`initDb.js:738-745`): instalada idempotentemente.
- ✅ **Verificação independente em Pass7-T1**: hash chain consistente; tentativa de UPDATE/DELETE bloqueada por trigger.
- ✅ **logAction não bloqueia operação se falhar** (`utils/auditLog.js:88-91`): captura erros e loga em console. Isso significa que se o trigger de hash falhar em uma row (ex.: pgcrypto não instalado), a operação principal não é abortada — mas a row entra **sem** `previous_hash`/`current_hash`, quebrando a chain. **Roadmap**: alertar quando linhas com hash NULL forem detectadas. Não é vulnerabilidade explorável.

### Outras verificações
- ✅ **Body parser limits**: `express.json({ limit: '1mb' })` global; `20mb` apenas em `/api/backup`. Bloqueia JSON bomb.
- ✅ **Trust proxy**: configurado `trust proxy: 1` (sem regressão).
- ✅ **Time bounds em `agendamentos.data_hora`**: tolerância 60s clock skew, máximo 100 anos no futuro.
- ✅ **Numerical bounds** (preços, comissões, quantidades, saldos): validados em P3-M3, P3-M5, P5-M8.
- ✅ **Backup restore tenancy**: força `salao_id = salaoId` em cada row do backup; whitelist explícita de colunas bloqueia injeção de `senha_hash`, `status`, `valor_final`.
- ✅ **Push notification content**: não vaza preço/comissão; token query filtrada por `salao_id`.
- ✅ **JWT cleanup job**: interval 1h, `unref()`, desabilitado em test.
- ✅ **Testes não-flaky**: 3 rodadas consecutivas — 9/9 PASS estável.

---

## Resumo

### Distribuição
- **Altos novos:** 0
- **Médios novos:** 1 (P10-M1 — bypass do state machine P9-A1 via raw UPDATE em rotas legacy do app profissional)
- **Baixos novos:** 0

### Total: **1 novo issue**

### Verificação dos fixes Pass 9: **3/3 ✅**

### Testes
- Suíte Jest: **9/9 PASS** (smoke 1 + static 2 + pass7 6)
- Pré-condição mantida: `DATABASE_SSL=true`

### Conclusão

**Sistema NÃO declarado convergência total.** A família "state machine ausente" tem uma 4ª instância ainda aberta — `appProfissional.iniciar/finalizar` — que faz raw UPDATE em `agendamentos.status` bypassando o `AgendamentoService.atualizar` (onde o P9-A1 vive).

Diferentemente de P9-A1 (rota administrativa exposta como `PUT /api/agendamentos/:id`), as rotas profissional são vetores **operacionais legítimos** que transicionam de `agendado/confirmado` → `em_andamento` → `finalizado`. Não são fraude direta em uso normal — mas em uso adversarial (profissional malicioso, sequence cancelado → finalizado), permitem ressuscitar agendamento morto e gerar atendimento/comissão fantasma.

A reconciliação requer **decisão de domínio** sobre o vocabulário canônico de `agendamentos.status` (atualmente fragmentado: `concluido` em `routes/relatorios.js`, `em_andamento`/`finalizado` em `routes/appProfissional.js`, `no_show`/`concluido` em P9-A1). Não é fix mecânico — requer um pass de unificação.

### Recomendações de manutenção (boas práticas — NÃO são issues)

1. **Reconciliação de vocabulário de status**: definir enum canônico de `agendamentos.status` em um único lugar (constants/agendamento.js) e referenciar em todas as queries/middlewares.
2. **API key revogação**: expor `DELETE /api/auth/apikey/:id` e `POST /api/auth/apikey/:id/rotate` com audit log.
3. **Push token length cap**: `body('pushToken').isLength({ max: 512 })` em `appAuth.js:163` e `appProfissionalAuth.js:106`.
4. **WebSocket handshake rate-limit por token**: defesa em profundidade contra flapping reconnect (atualmente mitigado por `MAX_CONNECTIONS_PER_USER=5`).
5. **Audit log chain integrity monitoring**: cron script ou view que detecta rows com `current_hash IS NULL` e alerta admins (chain break). Combinado com particionamento mensal (roadmap), permite GC de partições antigas após verificação.
6. **Idempotency-Key header em POST /vendas, POST /agendamentos, POST /comissoes/pagar**: roadmap de resilience (UX, não-security). Cliente mobile reenvia request com mesmo Idempotency-Key e servidor retorna 200 + body original.
7. **UNIQUE partial idx em `agendamentos(profissional_id, data_hora) WHERE status NOT IN ('cancelado','no_show')`**: defesa em profundidade contra race de overlap-check.
8. **Particionamento mensal de audit_log**: roadmap futuro — permite DROP PARTITION e mantém hash chain por partição.
9. **Cross-instance cache invalidation via Redis**: necessário só se sair de single-worker Render. Atual single-worker mantém in-process LRU.

---

## Próxima passada (Pass 11?)

**Se P10-M1 for aplicado** (state machine reconciliada + rotas appProfissional refatoradas), a família "state machine ausente" estará DEFINITIVAMENTE fechada em todas as 5 instâncias: vendas, atendimentos, agendamentos (rota admin), pedidos_loja, agendamentos (rota profissional). Convergência total seria declarável.

P10-M1 é fix de média urgência (vetor adversarial conhecido mas exige profissional autenticado interno do salão — não exploitable cross-tenant). Não bloqueia produção, mas deve entrar no próximo sprint.

---

*Pass 10 encerrado: 1 novo issue (P10-M1 médio), todos os 3 fixes do Pass 9 confirmados. Sistema NÃO declarado convergência total — P10-M1 é a 4ª instância da família que precisa de reconciliação de vocabulário + refator antes de declarar fechamento definitivo.*
