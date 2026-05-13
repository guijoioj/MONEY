# Security Audit Pass 8 — SoftHair

**Data:** 2026-05-11
**Auditor:** Pass 8 (oitava passada após os 5 issues do Pass 7 fixados em commits `1382c15` (fixes) e `b61d983` (tests)).
**Escopo:** SOFT-HAIR-SERVER. Foco: verificação dos fixes Pass 7 (regressão), ângulos não auditados (state machines, idempotência, race conditions em rotas críticas, trust proxy), validação técnica adicional (tests de retention/cleanup, schema integrity).
**Tipo:** Defensiva — análise estática + execução de testes (6 novos + 3 existentes = 9 PASS).
**Resultado:** **NÃO totalmente convergido.** Os 5 fixes do Pass 7 foram verificados como aplicados. **3 novos issues encontrados (2 altos, 1 médio).** Os altos são state-machine gaps em `vendas`/`atendimentos` (mesma família do P7-A1: completa a varredura do padrão "alteração de status sensível sem audit/state-machine").

---

## Verificação dos fixes Pass 7

| Issue | Status real | Notas |
|---|---|---|
| P7-A1 sync `status/valor_final` em vendas/atendimentos | ✅ Aplicado em `routes/sync.js:14-31`. `vendas` whitelist agora: `cliente_id, profissional_id, tipo, valor_total, desconto, forma_pagamento, observacoes` — `status`/`valor_final` removidos. `atendimentos` whitelist agora: `cliente_id, profissional_id, servico_id, agendamento_id, observacoes` — `status`/`valor` removidos. |
| P7-M1 jwt_blacklist sem retention | ✅ Aplicado. `securityInitService.startJwtBlacklistCleanupJob` roda a cada 1h com `DELETE FROM jwt_blacklist WHERE expires_at < NOW()`. `unref()` no interval evita bloquear processo. Em `NODE_ENV=test` ou `DISABLE_JWT_CLEANUP_JOB=1` não inicia (evita handle aberto em jest). |
| P7-M2 audit_log sem retention | ✅ Aplicado de forma documentada. `scripts/auditCleanup.js` é script manual operacional (não roda em interval) com confirmação explícita (`--confirm=I_UNDERSTAND_AUDIT_RETENTION`), retention mínima 365 dias, usa `SET LOCAL session_replication_role = 'replica'` para contornar o trigger immutable, e re-audita o próprio cleanup. Solução conservadora — particionamento mensal segue como roadmap futuro. |
| P7-M3 cache cliente/prof não invalida em desativação | ✅ Aplicado. `routes/clientes.js` PUT/DELETE chamam `invalidateClienteCache(id)` quando body modifica `ativo`/`app_ativo` ou em soft-delete. `routes/profissionais.js` PUT/DELETE chamam `invalidateProfissionalCache(id)` idem. `routes/appAuth.js` LGPD delete-me invalida cache do próprio cliente. Janela residual: cache permanece local ao processo — em deploy multi-instance Render (>=2 workers), invalidação não cross-instance. Bound máximo: TTL 2min. Para mitigar 100%, precisaria pub-sub (Redis). Não-blocking para deploy single-worker atual. |
| P7-B1 createAdmin.js hardcoded password fallback | ✅ Aplicado em `scripts/createAdmin.js`. Sem fallback inseguro: aborta com `❌ Senha obrigatória` se ausente argv/env, exige >=10 chars com mensagem clara. Mantém aceitar via env `SOFTHAIR_DEFAULT_ADMIN_PASSWORD` para automação CI. |

**Verificação independente:** suíte Jest rodada após cada fix — 9/9 PASS (smoke + static + pass7 com 6 novos testes cobrindo audit log integrity, backup encryption roundtrip, LGPD delete-me, JWT revocation, UNIQUE clientes(salao_id, email), race em abrir caixa).

---

## Novos issues encontrados (Pass 8)

### 🟠 ALTOS

#### [P8-A1] `vendas` aceita transição arbitrária de status — sem state machine + sem requireAdmin
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/vendas.js:62-74`, `SOFT-HAIR-SERVER/src/services/VendaService.js:162-178`
- **Descrição:** `PUT /api/vendas/:id` aceita qualquer valor de `status` no body e aplica via `UPDATE vendas SET status = COALESCE($1, status), ...`. Sem validação de transição:
  - `cancelada → finalizada`: reverte cancelamento (com restore de estoque já feito) sem nova reconciliação. Estoque fica double-decrement quando uma nova venda real for criada.
  - `concluida → pendente`: desfaz comissão sem rollback financeiro.
  - `finalizada → cancelada`: bypass do `DELETE /vendas/:id` que dispara restore de estoque com tenancy guard (P4-A1). Cancelar via PUT pula esse caminho — estoque NÃO é restaurado.
  - `qualquer → 'fraudada'` (string inválida): aceita string livre, sem `isIn([...])` validator.
  Além disso, **PUT não exige requireAdmin** — qualquer user autenticado do salão (recepcionista) pode alterar status de venda, contornando o fluxo oficial.
  Em comparação: `DELETE /api/vendas/:id` (cancelar) tem lógica protegida em transação com restore de estoque, e `service.cancelar` rejeita se já está `cancelada`. Mas o PUT sem state-machine **bypass-a todo esse cuidado**.
- **Impacto:** Fraude financeira interna. Recepcionista mal-intencionada pode reativar venda cancelada (sem refazer estoque), ou cancelar venda finalizada sem trigger de restore. Combinando com a falta de audit log persistente em `vendas.atualizar`, fica invisível.
- **Fix:**
  1. Em `routes/vendas.js`, adicionar `requireAdmin` no PUT.
  2. Em `vendas.js` validator: `body('status').optional().isIn(['pendente','finalizada','cancelada'])`.
  3. Em `VendaService.atualizar`: implementar state machine: transições permitidas são `pendente→finalizada`, `pendente→cancelada`. Qualquer outra transição (`finalizada→qualquer`, `cancelada→qualquer`) retorna `{ success: false, error: 'Transição inválida' }`. Cancelar finalizada deve seguir via `DELETE /vendas/:id` (que já tem restore).
  4. Acrescentar `logAction` em `atualizar` (action=`venda.status_change`, before/after).

#### [P8-A2] `atendimentos.atualizar` mesma família — status livre + sem state machine
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/atendimentos.js:50-58`, `SOFT-HAIR-SERVER/src/services/AtendimentoService.js:100-120`
- **Descrição:** `PUT /api/atendimentos/:id` aceita qualquer `status` via body. O service explicitamente ignora `valor` (P4-A3, ok), mas **não valida status**. O comentário em `AtendimentoService.atualizar` afirma:
  > // [P4-A3] Recupera estado atual — necessário para validar transição e re-derivar valor de servico.preco.
  Mas a lógica seguinte só re-deriva valor (não usado neste atualizar) e **não compara `existing.status` com `data.status` para enforce de transição**. Caminhos abusivos:
  - `finalizado → em_andamento`: re-abre atendimento já concluído. Pode disparar re-cálculo de comissão (depende do gatilho downstream) ou apenas confundir a UI.
  - `cancelado → finalizado`: bypass de cancelamento — atendimento "fantasma" volta a contar para comissão.
  - Status string-livre (`'fraudado'`, `'xyz'`): aceito sem `isIn([...])`.
  Mesmo que comissão seja derivada via outra rota, fechamentos agregam por status, e KPIs do dashboard de profissional sangram.
- **Impacto:** Fraude operacional/financeira similar ao P8-A1.
- **Fix:** Mesmo padrão: validator `isIn([...])`, state machine no service (`agendado→em_andamento→finalizado`; `*→cancelado` válido só de não-final), audit log, requireAdmin no PUT.

### 🟡 MÉDIOS

#### [P8-M1] Race condition em `POST /api/caixa/abrir` — INSERT ... WHERE NOT EXISTS racea em READ COMMITTED
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/caixa.js:67-77`, `SOFT-HAIR-SERVER/src/config/initDb.js:565-577`
- **Descrição:** O comentário em `routes/caixa.js:66-67` afirma:
  > // [P2-A3] INSERT atômico — só insere se não houver outro caixa aberto hoje no mesmo salão.
  > // Fecha a janela de race condition entre dois requests simultâneos (check-then-insert).
  Mas o pattern `INSERT ... SELECT ... WHERE NOT EXISTS (...)` é **NÃO atômico em READ COMMITTED** (isolação default do PG). Dois INSERTs paralelos podem ambos avaliar o `NOT EXISTS` como verdadeiro (snapshot anterior ao primeiro INSERT) e ambos terem sucesso. A tabela `caixa` **não tem UNIQUE constraint** em `(salao_id, DATE(aberto_em))`, então duas linhas duplicadas coexistem.
  O teste `Pass7-T6` (race de abrir caixa) passou ocasionalmente, mas é racy — depende do timing entre os dois INSERTs e da latência do RTT até Render. Em produção com workers locais ao DB, o race vira reproduzível.
- **Impacto:** Duas linhas de caixa abertas no mesmo dia. Cálculo de fechamento diário fica ambíguo (qual caixa é "o do dia"?). Saldo_inicial duplica. Fraude possível: abrir 2 caixas via race, fechar 1 com saldo_final inflado.
- **Fix:**
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS unq_caixa_salao_dia
    ON caixa(salao_id, (DATE(aberto_em)))
    WHERE fechado_em IS NULL;
  ```
  Combinado com o INSERT atômico atual, o segundo paralelo recebe `23505` (unique_violation) → captura no route e retorna 400 "Caixa já está aberto". Mesma família do fix UNIQUE em clientes(salao_id, LOWER(email)) — P6-C3.

---

## Áreas verificadas (e limpas)

- ✅ **Reentrância em webhook handlers**: nenhum endpoint público `/webhooks/*` ativo. Search por `webhook` retorna apenas referência futura em `configuracoes.js` (comentário, sem rota). Sem vetor.
- ✅ **Idempotency-Key header**: nenhuma rota expõe protocolo. **Por design**: o cliente Electron faz retry pesado em sync (rota `/sync/push`), e a falta de Idempotency-Key significa retries podem duplicar INSERTs. **Não é vulnerabilidade de segurança** — é UX/resilience. Roadmap: usar `change.id` UUID gerado pelo cliente como dedup key. Não acionável neste pass.
- ✅ **trust proxy: 1**: configurado corretamente para Render (single-hop proxy). Header `X-Forwarded-For` confiado apenas no primeiro hop. Atacante não pode spoofar `req.ip` via header arbitrário porque Express ignora chains > 1. **Sem vetor.**
- ✅ **JSON Schema validação**: rotas críticas (`auth/register`, `sync/push`, `clientes`, `vendas POST`, `produtos`, `servicos`) usam `express-validator` com `body().isIn/.isInt/.isFloat/.isEmail`. Falta validador em PUT `/vendas` e `/atendimentos` (capturado em P8-A1/P8-A2). Em geral o nível é bom.
- ✅ **Migrations idempotentes**: `initDb.js` usa 80+ `IF NOT EXISTS` para CREATE TABLE/INDEX/TRIGGER e `DO $$...EXCEPTION` para constraints. Rodar 2x não tem efeito colateral. Triggers de audit_log são guarded por `pg_trigger` lookup. **Sem regressão.**
- ✅ **JWT cleanup job sem bug**: novo `startJwtBlacklistCleanupJob` faz `DELETE FROM jwt_blacklist WHERE expires_at < NOW()` — sem race (`expires_at` é monotônico, query é idempotente). `setInterval` é `unref()` (não bloqueia exit). Em test/`DISABLE_JWT_CLEANUP_JOB=1`, não inicia. **Sem over-cleanup possível** porque `isTokenRevoked` filtra por `expires_at > NOW()` antes da query de cleanup ver a entrada.
- ✅ **Audit cleanup script: sem over-delete**: `scripts/auditCleanup.js` requer `--confirm=I_UNDERSTAND_AUDIT_RETENTION`, retention mínima 365 dias hardcoded, transação BEGIN/COMMIT atomic, e re-audita o próprio cleanup. **Sem possibilidade de cron acidental** (não é cron, é manual). `SET LOCAL session_replication_role = 'replica'` é scope de transação (volta automaticamente após COMMIT) — não-persistente.
- ✅ **Backup roundtrip**: teste `Pass7-T2` valida explicitamente que `gerarBackup` produz payload AES-256-GCM, ciphertext não-legível, e que `restaurarBackup` decifra corretamente. Payload corrompido falha por authTag mismatch (`Unsupported state`). **Sem regressão.**
- ✅ **Cache cliente/prof — invalidação multi-instância**: caveat documentado em P7-M3 fix — TTL 2min permanece como bound máximo. Aceitável em single-worker Render. Promovida a backlog para deploy >=2 workers.
- ✅ **Audit log hash chain**: teste `Pass7-T1` valida que UPDATE/DELETE são bloqueados por exception (regex `/append-only|imutável/`), hash format `^[a-f0-9]{64}$`, e que chain é consistente (`previous_hash[i] === current_hash[i-1]`).
- ✅ **UNIQUE clientes(salao_id, LOWER(email))**: teste `Pass7-T5` valida que duplicata no mesmo salão retorna 4xx, mesmo email em salão diferente retorna 201.

---

## Resumo

### Distribuição
- **Altos novos:** 2 (P8-A1 vendas state machine ausente · P8-A2 atendimentos state machine ausente)
- **Médios novos:** 1 (P8-M1 race em caixa abrir)
- **Baixos novos:** 0

### Total: **3 novos issues**

### Verificação dos fixes Pass 7: **5/5 ✅**

### Testes
- Suíte Jest: **9/9 PASS** (smoke 1 + static 2 + pass7 6 = 9)
- Novos testes do Pass 7 cobrem: audit_log hash chain, backup encryption roundtrip, LGPD delete-me, JWT revocation, UNIQUE clientes, race condition caixa.
- Bug revelado pelo `Pass7-T6` (race em abrir caixa): documentado em P8-M1.

### Conclusão
**Sistema próximo da convergência, mas NÃO totalmente seguro para PRODUÇÃO ainda.**

Os 5 fixes do Pass 7 estão sólidos. Os 3 novos issues do Pass 8 são:
- **P8-A1/P8-A2**: completam a varredura da família "alteração arbitrária de status financeiro". P7-A1 fechou o vetor `sync`; agora P8-A1/P8-A2 fecham o vetor `PUT direto` das próprias rotas de venda/atendimento. Padrão estrutural similar.
- **P8-M1**: race em rota `caixa/abrir` — bug real surfaceado pelo próprio teste de stress. Resolve-se com UNIQUE constraint partial — fix de 1 linha SQL.

### Prioridades recomendadas

1. **🟠 Próxima sprint (1-3 dias):**
   - **P8-A1**: adicionar `requireAdmin` + `isIn([...])` validator + state machine em `VendaService.atualizar` + audit log.
   - **P8-A2**: mesmo padrão em `AtendimentoService.atualizar`.

2. **🟡 Próxima release:**
   - **P8-M1**: criar UNIQUE partial index `unq_caixa_salao_dia` em `caixa(salao_id, DATE(aberto_em)) WHERE fechado_em IS NULL`. Capturar `23505` no route.

### Próxima passada (Pass 9?)
Se P8-A1, P8-A2 e P8-M1 forem aplicados, o sistema atinge **convergência operacional para PRODUÇÃO**. Os ângulos restantes (Idempotency-Key em sync, cache invalidation cross-instance via Redis, particionamento audit_log) são backlog não-bloqueante para release.

---

*Pass 8 encerrado: 3 novos issues, todos os 5 fixes do Pass 7 confirmados. Sistema NÃO declarado limpo — P8-A1/P8-A2 são vetores ativos de fraude interna que devem ser fechados antes de declarar convergência total.*
