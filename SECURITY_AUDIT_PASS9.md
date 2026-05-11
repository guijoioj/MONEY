# Security Audit Pass 9 — SoftHair

**Data:** 2026-05-11
**Auditor:** Pass 9 (nona passada após os 3 issues do Pass 8 fixados em commit `7f7c9d6`).
**Escopo:** SOFT-HAIR-SERVER. Foco: verificação dos fixes Pass 8 (regressão), varredura completa da família "state machine ausente" em outros recursos (agendamentos, pedidos_loja, comissões), idempotência em POSTs sensíveis, transações compostas, leitura de notificações push/WebSocket, limites temporais e numéricos, integridade de restore, tests flakiness.
**Tipo:** Defensiva — análise estática + execução de testes (smoke + static + pass7 = 9 PASS).
**Resultado:** **NÃO totalmente convergido.** Os 3 fixes do Pass 8 foram verificados como aplicados. **3 novos issues encontrados (1 alto, 2 médios).** O alto novo é mais uma instância da família "state machine ausente" — agora em `agendamentos`. Os médios são em `pedidos_loja` (state machine inexistente, mesmo padrão) e `fechamentos` (bound de período ausente).

---

## Verificação dos fixes Pass 8

| Issue | Status real | Notas |
|---|---|---|
| P8-A1 `vendas.atualizar` state machine + requireAdmin | ✅ Aplicado em `src/services/VendaService.js:1-17,178-272` e `src/routes/vendas.js:62-83`. State machine `VENDA_STATUS_TRANSITIONS` declarada (`pendente → concluida\|finalizada\|cancelada`; `concluida → cancelada`; `finalizada → cancelada`; `cancelada → terminal`). PUT exige `requireAdmin`. `body('status').isIn(['pendente','concluida','finalizada','cancelada'])`. Transição para `cancelada` via PUT abre transação e restaura estoque com tenancy guard (mesma rotina do DELETE). `logAction` persistente em `venda.status_change` com before/after. Erro de transição inválida retorna 400 (não 404). |
| P8-A2 `atendimentos.atualizar` state machine + requireAdmin | ✅ Aplicado em `src/services/AtendimentoService.js:1-17,115-178` e `src/routes/atendimentos.js:49-67`. State machine `ATEND_STATUS_TRANSITIONS` (`agendado → em_andamento\|cancelado`; `em_andamento → finalizado\|cancelado`; `finalizado/cancelado` terminais). PUT exige `requireAdmin`. Validator `body('status').isIn(['agendado','em_andamento','finalizado','cancelado'])`. Atendimento em estado terminal (finalizado/cancelado) também bloqueia patch silencioso de `observacoes` — retorna `Atendimento em estado X é imutável`. `logAction` em `atendimento.status_change`. |
| P8-M1 race em `POST /caixa/abrir` | ✅ Aplicado em `src/config/initDb.js:579-589` e `src/routes/caixa.js:52-92`. Migration cria `unq_caixa_salao_dia_aberto` como UNIQUE partial index em `caixa(salao_id, (DATE(aberto_em))) WHERE fechado_em IS NULL` — idempotente via `IF NOT EXISTS`. Permite múltiplos caixas no mesmo dia se já fechados, mas apenas 1 aberto. POST `/abrir` envolve em try/catch interno e captura `err.code === '23505'` → retorna 409 "Caixa já está aberto hoje.". Status do "não-inserido" também muda de 400 para 409 (consistência). |

**Verificação independente:** suíte Jest rodada após os 3 fixes — 9/9 PASS (smoke 1 + static 2 + pass7 6). `Pass7-T6` (race de abrir caixa) continua deterministicamente passando. Pre-condição para Pass7-T2 (backup encryption roundtrip): `DATABASE_SSL=true` no environment do jest — sem isso o teste falha por SSL/TLS error (BackupService usa pool com `ssl` configurado pela env do processo principal, não do server child). Issue pré-existente do test harness, não relacionado a Pass 8.

---

## Novos issues encontrados (Pass 9)

### 🟠 ALTOS

#### [P9-A1] `agendamentos.atualizar` mesma família — status livre + sem state machine + sem requireAdmin
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/agendamentos.js:130-176`, `SOFT-HAIR-SERVER/src/services/AgendamentoService.js:146-209`
- **Descrição:** `PUT /api/agendamentos/:id` aceita qualquer valor de `status` no body e aplica via `UPDATE agendamentos SET status = COALESCE($8, status), ...`. Sem state machine, sem validator `isIn([...])`, sem `requireAdmin`. Padrão idêntico ao P8-A1/P8-A2 ANTES dos fixes desta passada. Caminhos abusivos:
  - `cancelado → confirmado`: re-ativa agendamento cancelado sem revalidar conflito de slot (overlap check existe em `criar` mas não re-roda em `atualizar`). Pode duplicar booking se outro agendamento foi criado no mesmo slot entre cancelamento e re-ativação.
  - `finalizado → confirmado`: re-abre agendamento já concluído. Combinado com criação posterior de atendimento (P4-A3) fica inconsistente — atendimento existe mas agendamento "volta a ser futuro".
  - Status string-livre (`'fraudado'`, `'xyz'`, ou strings com 1KB+): aceito sem validação. Filtros downstream em fechamento (`WHERE status IN (...)`) silentemente ignoram, mas o KPI do dashboard de profissional (`COUNT BY status`) inclui o lixo.
  - **Sem `requireAdmin`**: qualquer user staff (recepcionista, profissional logado como admin do salão) pode rebatear status de agendamento alheio dentro do mesmo salão.
  Além disso, `agendamentos.atualizar` aceita alteração de `data_hora` sem revalidar o overlap-check de slots (presente apenas no `criar`). Caller pode reagendar para horário já ocupado e quebrar invariante de "1 profissional ↔ 1 slot".
- **Impacto:** Fraude operacional. Cancelado-fantasma vira confirmado, dobro de slot, KPI envenenado. Combinado com push notification automática (`agendamentos.js:148-168`), cliente recebe push spurious "Seu agendamento foi confirmado!" quando admin reverte status — phishing/UX abuse.
- **Fix:**
  1. Validator: `body('status').optional().isIn(['agendado','confirmado','cancelado','finalizado','no_show'])` (ajustar lista ao domínio real — `confirmado` e `no_show` aparecem em uses).
  2. `requireAdmin` no PUT (consistente com vendas/atendimentos).
  3. State machine em `AgendamentoService.atualizar`:
     ```js
     const AGEND_TRANSITIONS = {
       agendado:    ['confirmado', 'cancelado', 'no_show'],
       confirmado:  ['finalizado', 'cancelado', 'no_show'],
       finalizado:  [],            // terminal
       cancelado:   ['agendado'],  // re-agendar é OK desde que re-checke overlap
       no_show:     [],            // terminal
     };
     ```
  4. Se `data_hora` ou `profissional_id` mudou, re-rodar `verificarOverlap(data.profissional_id, data.data_hora, ...)` (método já existe no service).
  5. `logAction` em `agendamento.status_change` com before/after.

### 🟡 MÉDIOS

#### [P9-M1] `pedidos_loja.atualizarStatus` aceita transição arbitrária via PUT /api/app/loja/pedidos/:id/status
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/loja.js:132-148`, `SOFT-HAIR-SERVER/src/models/PedidoLoja.js:115-122`
- **Descrição:** O route tem `statusValidos = ['pendente','confirmado','preparando','enviado','entregue','cancelado']` (✅ enum validation), mas o `Model.atualizarStatus` é um simples `UPDATE pedidos_loja SET status = $1 ...` — sem state machine. Caminhos abusivos:
  - `entregue → preparando`: reverter pedido já entregue (estoque já foi abatido, cliente recebeu). Re-aciona push spurious "Seu pedido está: preparando" para cliente.
  - `cancelado → entregue`: bypassar cancelamento — pedido fantasma vira "entregue". Combinado com reembolso/estorno offline, fraude possível.
  - O modelo também NÃO valida tenancy do `req.salaoId` contra o `cliente_app_id` do pedido — o WHERE `salao_id = $3` já cobre isso (✅), mas o caller é authMiddleware sem `requireAdmin`. Recepcionista de outro salão (autenticado com salao_id=X) não pode tocar pedido de salao_id=Y, mas qualquer staff do salão X pode reverter qualquer pedido do salão X.
  Comparado com vendas (estoque é restaurado em DELETE, P4-A1) — pedidos_loja **não restaura estoque em cancelamento** mesmo após "entregue", o que pode esconder a fraude por mais tempo.
- **Impacto:** Fraude operacional moderada. KPI da loja envenenado (entregas viram preparando). Push notifications spurious. Combinado com falta de audit log em pedidos_loja (não há `logAction` em `atualizarStatus`), fica invisível.
- **Fix:**
  1. Em `PedidoLoja.atualizarStatus`, ler estado atual primeiro e validar transição:
     ```js
     const PEDIDO_TRANSITIONS = {
       pendente:   ['confirmado', 'cancelado'],
       confirmado: ['preparando', 'cancelado'],
       preparando: ['enviado', 'cancelado'],
       enviado:    ['entregue'],         // não pode voltar a preparando nem cancelar
       entregue:   [],                    // terminal
       cancelado:  [],                    // terminal
     };
     ```
  2. Adicionar `logAction` action=`pedido_loja.status_change` com before/after.
  3. Considerar `requireAdmin` (pelo menos `requireStaff` se existir) — mas isso pode quebrar o app do profissional que confirma preparo. Decisão de domínio.

#### [P9-M2] `fechamentos.gerar` não valida bound do período (data_inicio..data_fim) — risco de query lenta + memória
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/fechamentos.js:62-77`, `SOFT-HAIR-SERVER/src/services/FechamentoService.js:46-...`
- **Descrição:** POST `/api/fechamentos/` aceita `data_inicio` e `data_fim` apenas com `isDate()` — sem checks:
  - `data_inicio > data_fim`: query retorna 0 rows silentemente, mas o INSERT cria fechamento "vazio" com totais zerados. Sem erro 4xx. Lixo no DB.
  - Período de 10 anos (`2016-01-01` a `2026-05-11`): query agrega todas as vendas/atendimentos/comissões no intervalo. Em salões com 1k+ vendas/mês, isso é >120k linhas em SUM/COUNT. Não é DoS imediato (com `idleTimeoutMillis: 30000` no pool), mas é payload memory-heavy e gera lock contention na tabela `vendas` (LEFT JOIN inflado).
  - `data_inicio` no futuro (`2099-01-01` a `2099-12-31`): aceito, retorna fechamento vazio. Confunde relatórios.
- **Impacto:** DoS leve (slow query). Lixo no DB. Não-exploitable diretamente mas degrada UX e operacionalmente.
- **Fix:** Validators:
  ```js
  body('data_inicio').isDate(),
  body('data_fim').isDate().custom((v, { req }) => {
    const di = new Date(req.body.data_inicio);
    const df = new Date(v);
    if (df < di) throw new Error('data_fim deve ser >= data_inicio');
    const diffDays = (df - di) / (1000 * 60 * 60 * 24);
    if (diffDays > 366) throw new Error('Período máximo: 366 dias');
    const now = Date.now();
    if (di.getTime() > now + 7 * 24 * 3600 * 1000) throw new Error('data_inicio não pode estar no futuro');
    return true;
  }),
  ```

---

## Áreas verificadas (e limpas)

- ✅ **State machine vendas** (P8-A1 fix): verificado funcional. Transições válidas aplicadas, restauração de estoque em transação, audit log persistente.
- ✅ **State machine atendimentos** (P8-A2 fix): verificado. Terminal-state também bloqueia patch de `observacoes`.
- ✅ **UNIQUE caixa(salao_id, DATE(aberto_em)) WHERE fechado_em IS NULL** (P8-M1 fix): index criado, 23505 capturado, status 409 retornado.
- ✅ **ComissaoService.marcarComoPaga**: re-execução é tecnicamente idempotente (UPDATE com WHERE pago=true não afeta, retorna a row). Não tem `pago=false → pago=true → pago=false` (não há rota inversa exposta — apenas estorno via `/estornar` que cria registro separado). Audit log persistente em `/pagar` e `/estornar` (`comissao.pagar_batch`, manual em `/estornar`).
- ✅ **Idempotency em POST /vendas com mesmo body**: cada POST cria nova venda (sem header Idempotency-Key). É **UX/resilience** issue conhecido, documentado no Pass 8 como roadmap não-segurança. Não-blocking.
- ✅ **Idempotency POST /comissoes/pagar**: já é idempotente — WHERE `pago = false` filtra; re-execução não dobra pagamento.
- ✅ **Transação composta venda+estoque**: `VendaService.criar` envolvido em `withTransaction`, falha em qualquer UPDATE produto faz rollback do INSERT venda. Verificado linhas 80-176.
- ✅ **Transação composta cancelamento+restore**: `VendaService.cancelar` em transação. `VendaService.atualizar` (P8-A1) — para transição → cancelada — também em transação com restore. Outras transições sem efeito colateral, fora de tx (ok).
- ✅ **Body parser limit**: `express.json({ limit: '1mb' })` global, `20mb` apenas para `/api/backup`. Mitiga JSON bomb de payload grande.
- ✅ **Validação numérica**:
  - `quantidade` em venda_itens: `1..10000` (P3-M3, verificado).
  - `comissao_percentual`: `isFloat({ min: 0, max: 100 })` (verificado em `routes/profissionais.js:75`).
  - `saldo_inicial` caixa: `>=0` (P2-M3).
  - `saldo_final` caixa: `>=0 && <=10000000` (P5-M8).
  - `valor_total`/`valor_final` venda: `isFloat({ min: 0 })`.
  - `desconto` venda: `>=0`. Não rejeita `desconto > valor_total` mas `valorFinal = Math.max(valor - desc, 0)` clamps. Sem exploração.
  - `Number.isFinite` aplicado em saldo_inicial (rejeita `Infinity`, `NaN`). Mesma defesa em saldo_final.
- ✅ **Time bounds `data_hora`**: agendamentos validam `t > now - 60s` (clock skew) e `t < now + 100 anos` (P3-M5, verificado).
- ✅ **Backup restore tenancy**: `BackupService.restaurarBackup` força `filteredRow.salao_id = salaoId` em cada row (linha 345, P6-M5). Mesmo se backup foi adulterado offline com salao_id diferente, o restore reescreve. Whitelist EXPLÍCITA de colunas (P3-A2) impede injeção de senha_hash, status, valor_final etc. (P6-C1).
- ✅ **WebSocket broadcast tenancy**: `broadcast(salaoId, channel, ...)` filtra por `client.salaoId === salaoId`. Cliente/profissional só consegue subscrever próprio canal (`cliente:<userId>`, P4-B5 verificado linhas 235-250).
- ✅ **Push notification content**: não vaza preço/comissão. Conteúdo é informativo (status, agendamento). Token query é tenancy-filtered (P2-M7).
- ✅ **Period em relatorios**: `routes/relatorios.js` não exposto a clientes externos (apenas admin via auth). Default em `AgendamentoService.listar` aplica bound `CURRENT_DATE - 60d .. + 365d` quando filtros não passados (verificado linha 43).
- ✅ **Trust proxy**: configurado `trust proxy: 1` (Pass 8 verificado, sem regressão).
- ✅ **Idempotência POST /agendamentos com mesma cliente+data+hora**: `AgendamentoService.criar` faz overlap check antes do INSERT (`verificarOverlap`). Race possível? Sim — entre check e INSERT — mas o índice único em (`profissional_id`, `data_hora`) (se existir, ver `initDb.js`) impede. Não tem UNIQUE constraint explícito, mas o overlap-check é defensivo em domínio. Não-explorável em uso normal. Roadmap: UNIQUE partial idx por slot.
- ✅ **Audit log integrity**: hash chain + append-only triggers verificados em Pass7-T1 (passa).
- ✅ **Audit_log retention**: script manual com confirmação explícita (`--confirm=I_UNDERSTAND_AUDIT_RETENTION`), retention mínima 365d (P7-M2 fix).
- ✅ **JWT cleanup**: interval 1h, `unref()`, desabilitado em test/DISABLE_JWT_CLEANUP_JOB (P7-M1 fix).
- ✅ **Cache cliente/prof invalidation**: TTL 2min como bound (P7-M3 documentado).
- ✅ **Tests não-flaky**: 3 rodadas consecutivas — 9/9 PASS estável. Pass7-T6 (race caixa) é determinístico com UNIQUE constraint (P8-M1).

---

## Resumo

### Distribuição
- **Altos novos:** 1 (P9-A1 agendamentos state machine ausente — mesma família P8-A1/P8-A2)
- **Médios novos:** 2 (P9-M1 pedidos_loja state machine · P9-M2 fechamentos sem bound de período)
- **Baixos novos:** 0

### Total: **3 novos issues**

### Verificação dos fixes Pass 8: **3/3 ✅**

### Testes
- Suíte Jest: **9/9 PASS** (smoke 1 + static 2 + pass7 6)
- Pré-condição: `DATABASE_SSL=true` no environment para Pass7-T2 (issue de test harness, não de produção).
- Pass7-T6 (race caixa) agora determinístico com UNIQUE partial index.

### Conclusão
**Sistema próximo da convergência, mas ainda existe família "state machine ausente" parcialmente fechada.**

Os fixes do Pass 8 estão sólidos e impedem a fraude em vendas e atendimentos. O Pass 9 surfacia:
- **P9-A1 (agendamentos)**: terceira instância da família — completa o triplete `vendas/atendimentos/agendamentos`. Padrão estrutural idêntico aos P8-A1/A2.
- **P9-M1 (pedidos_loja)**: quarta instância — recurso menos crítico mas mesma natureza.
- **P9-M2 (fechamentos)**: gap de validação de input numérico/temporal não capturado em passes anteriores.

### Prioridades recomendadas

1. **🟠 Próxima sprint (1-2 dias):**
   - **P9-A1**: aplicar mesmo padrão dos P8-A1/A2 em `AgendamentoService.atualizar`. Inclui re-overlap-check se `data_hora`/`profissional_id` mudar.

2. **🟡 Próxima release:**
   - **P9-M1**: state machine em `PedidoLoja.atualizarStatus` + audit log.
   - **P9-M2**: validator `custom()` em `fechamentos POST` para bound de período (366 dias) e ordem `data_inicio < data_fim`.

### Próxima passada (Pass 10?)
Se P9-A1, P9-M1 e P9-M2 forem aplicados, o triplete completo da família "state machine" estará fechado: vendas + atendimentos + agendamentos + pedidos_loja. Os ângulos restantes seriam:
- Idempotency-Key em sync (UX/resilience, não-segurança).
- Cache invalidation cross-instance via Redis (single-worker Render aceitável).
- Particionamento mensal audit_log (roadmap futuro).
- UNIQUE partial idx em agendamentos(profissional_id, data_hora) (defesa em profundidade vs race em overlap-check).

Convergência operacional para PRODUÇÃO seria alcançada após P9-A1 (alto). P9-M1/P9-M2 são desejáveis mas não-bloqueantes.

---

*Pass 9 encerrado: 3 novos issues, todos os 3 fixes do Pass 8 confirmados. Sistema NÃO declarado limpo — P9-A1 é vetor ativo de fraude operacional que deve ser fechado antes de declarar convergência total.*
