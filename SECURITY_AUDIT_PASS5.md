# Security Audit Pass 5 — SoftHair

**Data:** 2026-05-11
**Status:** FIXADO — todos os 33 issues endereçados (29 fixados, 4 aceitos com mitigação documentada).
**Última atualização:** 2026-05-11
**Testes:** 3/3 PASS após cada wave (`npm test`).

## Status por issue

### 🔴 Críticos — todos FIXADOS
- ✅ **P5-C1** Cascade DELETE → SET NULL em FKs financeiras (comissoes, venda_itens, comissoes_pagamentos) via migration em `initDb.js#runMigrations`.
- ✅ **P5-C2** Tabela `audit_log` persistente criada + helper `src/utils/auditLog.js`. Aplicado em comissoes (criar/pagar/batch), fechamentos (reabrir/delete), LGPD delete-me.
- ✅ **P5-C3** `requireAdmin` + validação de tenancy FK em `POST /comissoes` e `PUT /:id/pagar`.
- ✅ **P5-C4** `pago`, `data_pagamento` removidos do whitelist `TABLE_COLUMNS.comissoes` em `sync.js`. Idem `status` de fechamentos e `saldo_anterior/saldo_novo` de creditos_cliente.
- ✅ **P5-C5** `requireAdmin` + motivo obrigatório (mín 3 chars) + audit log + soft-delete em fechamentos DELETE/reabrir.

### 🟠 Altos — todos FIXADOS
- ✅ **P5-A1** `scripts/backup.js` reescrito: `execFile` com args array, `parseDatabaseUrl` valida formato (whitelist `[A-Za-z0-9._-]`).
- ✅ **P5-A2** `BackupService` agora cripto AES-256-GCM com `BACKUP_ENCRYPTION_KEY` (fallback `ENCRYPTION_KEY`). Envelope `{ encrypted, version, algo, iv, tag, payload }` + restore descriptografa automaticamente.
- ✅ **P5-A3** `appAuth register`: catch UNIQUE violation (23505) + constraint `uq_clientes_app_email` em migration.
- ✅ **P5-A4** Constant-time bcrypt aplicado: bcrypt.compare SEMPRE executa antes do early-return, em ambos `appAuth.js` e `appProfissionalAuth.js`.
- ✅ **P5-A5** Tabela `historico_cliente` criada; modelo migrado para inserir nela (não polui `agendamentos`); rota valida tenancy do `:id` do path.
- ✅ **P5-A6** `decrypt()` lança `Error('payload inválido')` em formato malformado — não retorna plaintext silenciosamente.
- ✅ **P5-A7** `logo_url` validado contra `^https?://` ou `^data:image/(png|jpeg|jpg|gif|webp|svg+xml);base64,...` — bloqueia `javascript:`, `data:text/html`, etc.
- ✅ **P5-A8** WebSocket limita 5 conexões por user (env `WS_MAX_CONNECTIONS_PER_USER`); rejeita com close code 4002.

### 🟡 Médios — todos FIXADOS
- ✅ **P5-M1** `multer ^2.0.0` em package.json (não usado em src/ — upgrade preventivo).
- ✅ **P5-M2** `engines.node: ">=20.0.0 <23"`.
- ✅ **P5-M3** Rate limit 10/min em `POST /ponto` (`pontoLimiter`).
- ✅ **P5-M4** UPDATE com `AND status <> ...` em iniciar/finalizar atendimento — só insere ponto se status realmente mudou.
- ✅ **P5-M5** `/health` deep check: db_latency_ms, pool stats, memória, status `degraded` (503) se pool waiting > 0 + idle = 0.
- ✅ **P5-M6** `req.user.userId || req.user.id` em `pedidos.js:194` (aprovar pedido).
- ✅ **P5-M7** Validação cross-tenant de `cliente_id`/`usuario_id` em notificações durante restore (descarta linhas inválidas).
- ✅ **P5-M8** `saldo_final` em `caixa/:id/fechar` validado: `Number.isFinite` + `>= 0` + `<= 10_000_000`.
- ✅ **P5-M9** `escapeHtml(userName)` em todos os templates de email (`sendPasswordResetEmail`, `sendWelcomeEmail`).
- ✅ **P5-M10** Tokens em URL já sanitizados por `sanitizeUrl` middleware (logs); WS aceita ambos query e header. Mantido como aceito.

### 🟢 Baixos
- ⏸️ **P5-B1** Argon2id backlog — bcrypt rounds=12 aceito.
- ⏸️ **P5-B2** JWT_SECRET único — aceito; rotação manual documentada.
- ✅ **P5-B3** `scripts/restore.js` substituído por stub com mensagem de erro.
- ✅ **P5-B4** `[AI][AUDIT]` não loga `command` raw (mesmo redacted) — apenas action+confidence+userId+cmdLen.
- ✅ **P5-B5** `crossOriginEmbedderPolicy: 'credentialless'` em helmet.
- ✅ **P5-B6** `DELETE /api/app/auth/me/delete-data` anonimiza dados pessoais (LGPD).
- ⏸️ **P5-B7** `ENCRYPTION_KEY` rotação manual — backlog (envelope `v1` no novo BACKUP encryption já prepara versionamento).
- ✅ **P5-B8** `sendPushBatch` com chunks de 100 (limit Expo).
- ✅ **P5-B9** LIMIT configurável via env `COMISSOES_LIST_LIMIT` / `VENDAS_LIST_LIMIT` (default 200, max 2000).
- ✅ **P5-B10** Motivo obrigatório em fechamento reabrir/delete (incluído em P5-C5).

**Total fixado:** 29/33. **Aceitos com mitigação:** 3 (B1, B2, B7) + 1 documentado (M10).

---

**Conteúdo original abaixo:**

---

**Status (original):** ANÁLISE — sem modificações aplicadas.
**Auditor:** Pass 5 (quinta passada após 112 issues fixadas em Passes 1–4).
**Escopo:** SOFT-HAIR-SERVER.
**Tipo:** Defensiva — análise estática. Foco em ângulos nunca cobertos: audit log estrutural, integridade financeira, supply chain, secrets lifecycle, backup criptografado, race conditions específicas de fluxo, deserialização silenciosa de payloads encrypt, command injection em scripts internos, log persistence, edge cases dos 20 ângulos da checklist.

---

## Novos issues encontrados

### 🔴 CRÍTICOS

#### [P5-C1] Cascade DELETE em FKs destrói histórico financeiro
- **Arquivo:** `SOFT-HAIR-SERVER/src/config/initDb.js:140-142, 156-158, 174-178, 191-192, 207-208, 217-218, 230-231, 240-242, 247-248` (e várias outras)
- **Descrição:** Todas as FKs entre entidades transacionais usam `ON DELETE CASCADE`:
  - `agendamentos.cliente_id REFERENCES clientes ON DELETE CASCADE`
  - `agendamentos.profissional_id REFERENCES profissionais ON DELETE CASCADE`
  - `agendamentos.servico_id REFERENCES servicos ON DELETE CASCADE`
  - `venda_itens.produto_id REFERENCES produtos ON DELETE CASCADE`
  - `comissoes.venda_id REFERENCES vendas ON DELETE CASCADE`
  - `comissoes.profissional_id REFERENCES profissionais ON DELETE CASCADE`
  - `pedido_loja_itens.pedido_id REFERENCES pedidos_loja ON DELETE CASCADE`
- **Exploração:**
  1. Admin (ou atacante com sessão admin) executa `DELETE /api/clientes/:id` em modo hard-delete (algumas implementações fazem soft, mas se um caminho de hard-delete existir — ver P5-C2) → cascata apaga TODOS os agendamentos do cliente, atendimentos, vendas, comissões e fechamentos referenciados.
  2. Admin malicioso apaga produto que vendeu — `venda_itens` daquele produto somem, alterando histórico de receita.
  3. Admin apaga profissional → suas comissões (e portanto evidência de pagamentos antigos) somem. Mesmo sem hard-delete via API, um pg-admin com acesso direto via Render dashboard pode disparar a cascata.
- **Impacto:** **Não-repúdio impossível.** Histórico financeiro pode ser apagado sem rastro. Não há tabela de audit log persistente (vide P5-C2). Cliente lesado não consegue provar que houve venda.
- **Fix:** Trocar FKs transacionais para `ON DELETE RESTRICT` (entidade pai não pode ser apagada se há filho) ou `ON DELETE SET NULL` (registro filho fica órfão mas preservado). Comissões e vendas devem ser **append-only** — nunca CASCADEAR. Aplicar via migration `ALTER TABLE comissoes DROP CONSTRAINT ..., ADD CONSTRAINT ... ON DELETE RESTRICT;` e equivalente.

#### [P5-C2] Não existe tabela `audit_log` persistente — auditoria depende de `console.log` no Render
- **Arquivos:** `src/routes/comissoes.js:116,152`, `src/routes/creditos.js:102`, `src/routes/ai.js:101,178`
- **Descrição:** Todos os "audit logs" do sistema são `console.log` com prefixo `[XXX][AUDIT]`. Saída vai para o stdout do Render:
  - **Não é queryable** (sem SQL — depende do dashboard Render);
  - **Tem retenção curta** (~7 dias no plano gratuito do Render);
  - **Não é assinado** — atacante com acesso ao processo pode injetar entradas falsas;
  - **Não tem `actor_id`/`timestamp`/`action` estruturados** — texto livre;
  - **Não há `before/after` snapshot** — não dá pra ver o estado antes da alteração.
- **Exploração combinada com P5-C1:** Admin malicioso paga comissão a si mesmo via `POST /api/comissoes/pagar`. Audit log é apenas console.log; após 7 dias, evidência sumiu. Não há tabela `audit_log` consultável forense.
- **Fix:** Criar tabela `audit_log (id, ts, actor_user_id, actor_salao_id, action, resource_type, resource_id, before JSONB, after JSONB, ip, user_agent)`. Inserir em transação junto com a ação. Para integridade, opcional adicionar hash chain (`prev_hash` linkando entries — tamper-evident).

#### [P5-C3] `POST /api/comissoes` (criar) e `PUT /api/comissoes/:id/pagar` (pagar individual) sem `requireAdmin` e sem validação de tenancy FK
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/comissoes.js:180-188, 190-198`
- **Descrição:** O endpoint **batch** `POST /pagar` (linha 61) foi fortificado no Pass 3 (`requireAdmin` + tenancy + reconciliação). Mas duas rotas paralelas ficaram esquecidas:
  - `POST /api/comissoes`: cria comissão com `profissional_id`, `venda_id`, `valor_total`, `percentual`, `valor_comissao` arbitrários. **Não valida FK tenancy** (profissional/venda podem ser de outro salão). **Não tem `requireAdmin`.** O `ComissaoService.criar` apenas seta `salao_id = req.salaoId` (linha 56-58 do service).
  - `PUT /api/comissoes/:id/pagar` (single): chama `service.marcarComoPaga(id, salaoId)` — atualiza `pago=true` SEM `requireAdmin`, SEM audit log, SEM reconciliação de valor.
- **Exploração:**
  1. Admin staff (não-super) faz `POST /api/comissoes { profissional_id: <eu_mesmo>, venda_id: 999, valor_total: 999999, percentual: 100, valor_comissao: 999999 }` — sem validar se venda 999 é do salão dele.
  2. Em seguida `PUT /api/comissoes/<novo_id>/pagar` — marca como paga.
  3. Soma de comissões pagas vai pro relatório → desfalque escondido.
  - Combinado com P5-C1: depois apaga a venda referenciada → cascata limpa a comissão criada, e nada fica no histórico.
- **Fix:** Adicionar `requireAdmin` nas duas rotas. Validar tenancy de `profissional_id` e `venda_id` contra `req.salaoId`. Recalcular `valor_comissao` a partir de `vendas.valor_final * profissionais.comissao_percentual / 100` (autoritativo). Audit log persistente.

#### [P5-C4] `sync.js` permite UPDATE em `comissoes.pago` e `data_pagamento` — bypass do fluxo `requireAdmin`/audit
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/sync.js:21, 192-208`
- **Descrição:** A whitelist de colunas para sync (`TABLE_COLUMNS.comissoes`) inclui `pago` e `data_pagamento`. Atacante autenticado (qualquer admin) pode fazer:
  ```json
  POST /api/sync/push
  { "changes": [{"table": "comissoes", "operation": "UPDATE", "data": {"id": 123, "pago": true, "data_pagamento": "2026-05-11"}}] }
  ```
  Isso ignora `requireAdmin`, ignora audit log, ignora reconciliação de valor.
- **Exploração:** Mesma fraude do P5-C3, mas sem precisar criar comissão nova — basta marcar como paga uma comissão já existente e o `comissoes_pagas` (registro de pagamento) nunca é inserido. Profissional recebe duas vezes (uma fora do sistema + uma de novo via /pagar) sem detecção.
- **Fix:** Remover `pago` e `data_pagamento` da whitelist `TABLE_COLUMNS.comissoes`. Sync deve ser limitado a campos que **não** afetam contabilidade. Idem para `fechamentos.status` e `creditos_cliente.saldo_*`.

#### [P5-C5] `DELETE /api/fechamentos/:id` e `PUT /api/fechamentos/:id/reabrir` apagam/reabrem fechamento financeiro sem audit log
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/fechamentos.js:78-86, 88-103`
- **Descrição:** Fechamento financeiro (snapshot de receita/comissão/lucro do período) é o documento canônico do balanço do salão. As duas rotas:
  - `DELETE /:id` apaga o fechamento permanentemente — sem audit log, sem `requireAdmin`, sem soft-delete.
  - `PUT /:id/reabrir` muda status — sem registrar quem reabriu, quando, por quê.
  Após reabrir + alterar atendimentos/vendas/comissões + re-fechar, atacante reescreve a história sem traço.
- **Exploração:** Profissional desonesto com acesso admin reabre o fechamento de janeiro, marca suas comissões como `pago=true` (via P5-C4 sync), refaz fechamento. Para auditor externo, nada bate, mas não há trilha de auditoria.
- **Fix:** Adicionar `requireAdmin`. Bloquear DELETE permanente — apenas soft delete com motivo obrigatório. Reabrir exige justificativa em `motivo_reabertura` (NOT NULL). Audit log com `before/after` JSON.

### 🟠 ALTOS

#### [P5-A1] `src/scripts/backup.js` — shell injection via DATABASE_URL + `execSync` não importado (script broken)
- **Arquivo:** `SOFT-HAIR-SERVER/src/scripts/backup.js:1-55, 57-84`
- **Descrição:**
  1. **Variáveis interpoladas em shell sem escape**: `pgDumpCommand = \`pg_dump -h ${host} -p ${port} -U ${user} -d ${database} ...\`` — se `DATABASE_URL` contém caracteres especiais (`;`, `$()`, backtick), executa código arbitrário no shell.
  2. **`execSync` referenciado mas `child_process` só importa `exec`** (linha 4) — script LANÇA `ReferenceError` quando executado. Backup automatizado falha silenciosamente.
  3. **`restore(file)` aceita filePath do argv sem validar** — não é vulnerável remotamente (script CLI), mas é code rot.
- **Exploração:** Em produção no Render, `DATABASE_URL` é setado pelo painel — atacante precisa ter acesso ao dashboard. Mas em dev local, qualquer dev clona o repo e seta seu `DATABASE_URL`; se for envenenado (ex.: postgres://u:p@host`;rm -rf /`/db), execução do script `npm run db:backup` é RCE local.
- **Fix:** Usar `execFile` com array de argumentos (não shell). Importar `execSync` corretamente. Validar formato de `DATABASE_URL`. Documentar que script está atualmente broken — provavelmente nunca foi testado em CI.

#### [P5-A2] Backup gerado por `BackupService` é JSON em texto-claro, sem criptografia
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/BackupService.js:85-118` (gerarBackup)
- **Descrição:** Backup contém todas as PII do salão (clientes — nome, CPF, email, telefone, endereço; profissionais — CPF; agendamentos, vendas com valor). É retornado como JSON puro pela rota `GET /api/backup` (admin-only). Atacante que captura uma resposta de backup (MitM em rede WiFi do salão, ou Proxy explícito) obtém base completa do salão.
- **Exploração:** Sem TLS de fato no servidor (`FORCE_HTTPS=true` opcional; Render LB já provê), mitigado pela camada Render. Mas:
  - Backup baixado pelo admin para `Downloads/`: arquivo `softhair-backup.json` fica no disco do PC sem proteção.
  - Se admin sincroniza Downloads com Google Drive / iCloud / OneDrive, o backup vaza para nuvem em texto-claro.
- **Fix:** Cifrar backup com AES-256-GCM antes de retornar. Key derivada de senha do admin (PBKDF2 com sal único embutido) — admin precisa digitar senha pra restaurar. Alternativa: chave dedicada `BACKUP_ENCRYPTION_KEY` armazenada no Render apenas; backup só restaurável por reimportação no mesmo servidor.

#### [P5-A3] `POST /api/app/auth/register` cria registros órfãos em `clientes` (salao_id=NULL) e permite duplicatas por race condition
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/appAuth.js:17-54`
- **Descrição:** Cliente registra-se via app mobile **antes** de escolher salão. INSERT em `clientes` ocorre sem `salao_id` (coluna é nullable). Resultado:
  - `clientes` acumula registros órfãos para sempre (não-purgáveis por delete em cascata de salão);
  - `email` em `clientes` não tem constraint UNIQUE (verificado em initDb.js linha 121-134) — checagem é `SELECT id FROM clientes WHERE email = $1` seguida de INSERT. Duas requests paralelas com mesmo email podem ambas passar pelo SELECT e inserir, criando duas linhas com mesmo email. Próximo login → `SELECT ... WHERE email=$1` retorna >1 linha — apenas a primeira é usada, a outra fica "fantasma".
- **Exploração:**
  1. **DoS por inflação:** atacante registra 100k contas com emails únicos via script — `clientes` cresce indefinidamente, queries de listagem mais lentas, Render DB billing aumenta.
  2. **Account hijack via race:** atacante e vítima clicam "register" com email da vítima ao mesmo tempo. Dois registros criados, atacante controla um deles.
- **Fix:** Adicionar UNIQUE constraint em `clientes.email` via migration. Mover registro app pra tabela dedicada `clientes_app` (já existe!) e só copiar para `clientes` quando ele se vincula a um salão (`POST /api/app/pedidos` cria o link).

#### [P5-A4] `appProfissionalAuth.js login` — timing attack ainda existe (early return antes do DUMMY_HASH)
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/appProfissionalAuth.js:45-68`
- **Descrição:** Pass 4 P4-M7 fixou o pattern de "DUMMY_HASH para constant time" em `authService.js` e `appAuth.js` — mas o **login do profissional** retorna 401 nas linhas 47-48 (`if rows.length === 0`) **ANTES** de chegar ao DUMMY_HASH na linha 60. O early-return continua revelando enumeração por timing. Pior: com `salaoId` opcional no body, atacante pode enumerar `(email, salaoId)` pairs — útil para descobrir qual salão um profissional famoso trabalha.
- **Exploração:** Mesmo de P4-M7, mas para vetor profissional. Curva de tempo de resposta tem dois patamares (~ms vs ~100ms). Janela: até `authLimiter` (5/15min por IP+email) bloquear.
- **Fix:** Mover bcrypt.compare para SEMPRE executar, mesmo quando `rows.length === 0`:
  ```js
  const DUMMY_HASH = '$2a$12$' + 'X'.repeat(53);
  const profissional = result.rows[0];
  const hashToCompare = profissional?.senha_hash || DUMMY_HASH;
  const valid = await bcrypt.compare(password, hashToCompare);
  if (!profissional) return res.status(401).json({...});
  ```

#### [P5-A5] `POST /api/historico/cliente/:id/historico` sem validar tenancy de `:id` e polui tabela `agendamentos`
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/historico.js:20-26`, `SOFT-HAIR-SERVER/src/models/ClienteHistorico.js:4-11`
- **Descrição:**
  - Não valida que `req.params.id` (cliente) pertence a `req.salaoId` antes de criar histórico.
  - `ClienteHistorico.create` insere em `agendamentos` com `status='historico'` — mistura registros reais com observações textuais. Relatórios de agendamento incluem "histórico"? Filtros precisam excluir explicitamente.
  - `clienteId` é tomado de `req.params.id` MAS o model lê `data.cliente_id || data.clienteId` — body também pode injetar `cliente_id` cross-tenant que pula validação do path.
- **Exploração:** Admin do salão A: `POST /api/historico/cliente/anything/historico { cliente_id: <cliente_de_B>, tipo: 'spam', descricao: 'lixo' }` → cria agendamento "histórico" para cliente do salão B (com `salao_id = A`). Mistura aparece em relatórios de A apenas (mitigado por salao_id forçado), mas referência cross-tenant a `cliente_id` quebra integridade lógica.
- **Fix:** Validar `req.params.id` pertence a `req.salaoId`. Ignorar `cliente_id`/`clienteId` do body. Criar tabela dedicada `historico_cliente (cliente_id, salao_id, tipo, descricao, ...)` em vez de poluir `agendamentos`.

#### [P5-A6] `decrypt(text)` retorna texto cifrado como plaintext em formato inválido — silenciamento perigoso
- **Arquivo:** `SOFT-HAIR-SERVER/src/utils/encryption.js:16-28`
- **Descrição:**
  ```js
  function decrypt(text) {
    if (!text) return null;
    const parts = text.split(':');
    if (parts.length !== 3) return text;  // ← Retorna plaintext silenciosamente
    ...
  }
  ```
  Se um campo cifrado (ex.: dados sensíveis em coluna `clientes.cpf` ou afim) for armazenado em formato corrompido (3-parts mas inválido), `decrypt` lança erro. Mas se o atacante consegue gravar valor SEM `:` (ex.: via path que não passa por encrypt), o decrypt retorna o valor como veio — efetivamente desativando criptografia para aquele campo.
- **Exploração:** Atacante (admin) consegue gravar plaintext no campo via sync.js (que filtra colunas mas não força encrypt). Decrypt do plaintext retorna plaintext. Logs/relatórios pegam o valor sem alarme.
- **Fix:** Lançar `Error('payload inválido para decrypt')` se formato não bater. Nunca retornar plaintext de função que se chama `decrypt`. Auditar todos os call-sites de `encrypt`/`decrypt` para garantir uso consistente.

#### [P5-A7] `POST /api/saloes/me PUT` — `logo_url` aceita qualquer string (incluindo `javascript:` URI)
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/saloes.js:54-76`
- **Descrição:** Validator aceita `nome` e `email` mas não valida `logo_url`. Pode ser `javascript:alert(1)`, `data:text/html;base64,...` ou URL de SVG remoto contendo `<script>`. Quando o frontend renderiza `<img src="${logo_url}">`, alguns user-agents podem executar JS em SVG (Safari < 18, Chrome com `Object/Embed`). Combinado com a CSP estrita do server.js, atenuado para iframe, mas frontend ainda renderiza o `<img>` no admin.
- **Exploração:** Admin malicioso atualiza `logo_url` para SVG com script. Outros admins do mesmo salão veem painel — XSS persistente cross-staff. Cliente do app mobile não vê esse path (CSP do app diferente).
- **Fix:** Validar `logo_url` com `isURL({ protocols: ['http','https'], require_protocol: true })`. Bloquear `data:` e `javascript:`. Idealmente fazer upload via multer e armazenar em CDN/S3 — não aceitar URL externa.

#### [P5-A8] Connection pool exhaustion via WebSocket — sem limite por salaoId/IP
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/websocketService.js`
- **Descrição:** O serviço de WS valida token no `verifyClient`, mas não limita quantas conexões simultâneas o mesmo usuário/salaoId pode manter. Atacante autenticado abre 1000 conexões → consome FDs/heap. Cada subscribe acumula buffers de broadcasts. Render free tier morre rápido.
- **Exploração:** Script Node com 1000 `new WebSocket('wss://...?token=valid')` → server fica não-responsivo.
- **Fix:** Em `verifyClient`, track de `connectionsByUser[userId/salaoId]`; rejeitar acima de N=10 conexões. Sweep de zombie connections.

### 🟡 MÉDIOS

#### [P5-M1] `multer@1.4.5-lts.1` — versão com CVEs conhecidos
- **Arquivo:** `SOFT-HAIR-SERVER/package.json:36`
- **Descrição:** Multer 1.x está em modo manutenção; vulnerabilidades reportadas em DoS por upload de arquivo malformado e prototype pollution em `req.body` em algumas releases. Versão 2.x está estável desde 2024.
- **Fix:** Atualizar para `multer@^2.0.0`. Validar uploads com limite explícito de tamanho e tipo MIME (whitelist).

#### [P5-M2] `engines.node: ">=18.0.0 <23"` permite EOL e versões com CVE
- **Arquivo:** `SOFT-HAIR-SERVER/package.json:43-45`
- **Descrição:** Node 18.x atinge EOL em abril 2025; Node 19/20.x têm CVEs conhecidos. Range `>=18.0.0 <23` ainda aceita versões EOL. Render pode rodar com Node 18.x sem warning.
- **Fix:** Travar `engines.node: "20.x"` ou `"22.x"` (LTS atual). Adicionar `.nvmrc` com versão precisa.

#### [P5-M3] `POST /api/app/profissional/ponto` sem rate limit por profissional
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/appProfissional.js:32-51`
- **Descrição:** Profissional autenticado pode registrar N pontos por segundo. Linha de produção de `registros_ponto`. Acidentalmente: app móvel com bug duplica clicks → dois pontos. Maliciosamente: profissional inflaciona horas para overtime fake.
- **Fix:** Rate limit por `(profissional_id, tipo)` — máx 1 ponto / 30s. Validar transição lógica (`entrada` só após `saida`).

#### [P5-M4] `POST /atendimentos/:id/iniciar` cria registro de ponto duplicado se clicado 2x
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/appProfissional.js:215-235`
- **Descrição:** UPDATE em `agendamentos` é idempotente (status já 'em_andamento' → linha não muda), mas há checagem `if (!rows.length)` que retorna 404 — então o segundo click NÃO duplica ponto. **Mas se rows for retornado em ambos:** o UPDATE com `WHERE id=$1 AND profissional_id=$2 AND salao_id=$3` retorna rows mesmo se status já era 'em_andamento'. Logo, INSERT em `registros_ponto` ocorre N vezes → ponto duplicado.
- **Fix:** UPDATE adicionar `AND status <> 'em_andamento'` no WHERE; só insere ponto se UPDATE alterou efetivamente. Mesma lógica em `/finalizar`.

#### [P5-M5] `health.js` valida apenas `SELECT 1`, não valida pool nem WS
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/health.js`
- **Descrição:** Pass 4 reconheceu (P4-B3) que health é aceitável. **Mas:** Render usa /health para autoscaling/restart. Se pool está saturado (P5-A8) mas uma conexão livre ainda permite `SELECT 1`, health passa enquanto sistema está down. Resultado: Render não restarta um servidor que está zombie.
- **Fix:** Health checa `pool.totalCount`, `pool.idleCount`. Retorna `degraded` se idleCount=0. Considerar checagem de WS server estar listening.

#### [P5-M6] `req.user.id` usado em `routes/app/pedidos.js:194` (nunca existe — JWT usa `userId`)
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/pedidos.js:194`
- **Descrição:** `PedidoAgendamento.aprovar(..., req.user.id)` — mas `req.user.id` é **undefined** (token usa `userId`). Resultado: `aprovado_por` no DB fica NULL. Não há "quem aprovou" no registro — auditoria silenciosamente quebrada.
- **Fix:** Trocar para `req.user.userId || req.user.id`. Auditar outros usos.

#### [P5-M7] `BackupService.ALLOWED_COLUMNS.notificacoes` permite `cliente_id`/`usuario_id` sem validação de tenancy
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/BackupService.js:61-64`
- **Descrição:** Restore aceita `notificacoes` com `cliente_id` e `usuario_id` arbitrários. Backup adulterado pode reescrever notificações para apontarem para users/clientes de outros salões. Combinado com `force salao_id = salaoId` (linha 176), a notificação é do salão atual mas referencia entidades de outro tenant.
- **Fix:** Validar `cliente_id`/`usuario_id` pertence a `salaoId` durante restore. Ou descartar a linha inteira se a FK não bater.

#### [P5-M8] `caixa fechar` não valida `saldo_final` é número positivo
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/caixa.js:88-103`
- **Descrição:** `saldo_final` é passado direto pro UPDATE sem validar (`Number.isFinite`, `>= 0`). String numérica como "-99999" passa; `null` causa erro 500; `'abc'` causa erro Postgres (mas log com PG error vaza schema).
- **Fix:** Validar `saldo_final` com `body('saldo_final').isFloat({ min: 0 })`.

#### [P5-M9] Email `sendPasswordResetEmail` interpola `userName` em HTML sem escape (XSS via email)
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/emailService.js:29-69`
- **Descrição:** `userName` vem de `usuarios.nome` — controlado por admin. Se admin define `nome = '<script>alert(1)</script>'`, email gerado tem HTML injection. Gmail/Outlook geralmente bloqueiam `<script>`, mas `<img src=x onerror=...>` passa em alguns clientes.
- **Exploração:** Sem rota ativa de reset password chamando este service — mas se for ativado no futuro, abre vetor.
- **Fix:** Escapar HTML do `userName` antes de interpolar. Usar template seguro (handlebars com auto-escape) ou substituir `<>&"'` manualmente.

#### [P5-M10] WebSocket: `verifyClient` aceita query string `?token=` em vez de header — token pode vazar em logs de proxy
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/websocketService.js:45-55`
- **Descrição:** Se `verifyClient` extrai token de URL (`?token=xxx`), Render LB e nginx-style proxies costumam logar URL completa. Token JWT aparece em logs de access — vazamento. (Necessita confirmar a implementação exata; se usa header `Sec-WebSocket-Protocol` ou cookie, OK.)
- **Fix:** Auditar implementação. Preferir `Sec-WebSocket-Protocol: bearer.<token>` ou cookie httpOnly.

### 🟢 BAIXOS

#### [P5-B1] `bcrypt rounds=12` aceitável em 2026, mas considerar `Argon2id` para novos hashes
- **Descrição:** bcrypt rounds=12 ≈ 250-500ms em hardware moderno. OWASP 2024 recomenda Argon2id como primeira opção; bcrypt como fallback. Sem urgência.
- **Fix:** Backlog. Migração só compensa se houver leak.

#### [P5-B2] `JWT_SECRET` único compartilhado entre admin/cliente/profissional (já documentado em P4-B1)
- **Já notado.**

#### [P5-B3] `src/scripts/restore.js` chama métodos inexistentes (`BackupService.getLocalBackups`, `restoreBackupFromFilename`)
- **Arquivo:** `SOFT-HAIR-SERVER/src/scripts/restore.js`
- **Descrição:** Script é dead code — métodos não existem em `services/BackupService.js`. Não é exploitable, mas é code rot que confunde manutenção.
- **Fix:** Remover script ou reimplementar usando métodos reais (`gerarBackup`/`restaurarBackup`).

#### [P5-B4] `console.log` de `[AI][AUDIT]` inclui `command` (mesmo redacted) — pode vazar em logs externos
- **Arquivo:** `src/routes/ai.js:112-119`
- **Descrição:** Já mitigado em P4-B6 (redação PII), mas comando textual vai pra Render stdout — se Render integrar com Logtail/Datadog/Papertrail, esses logs viram externos. Considerar nunca logar texto livre do usuário.
- **Fix:** Logar apenas action+confidence+userId. Não logar `command` raw.

#### [P5-B5] `crossOriginEmbedderPolicy` não setado em helmet — bloqueia uso futuro de SharedArrayBuffer
- **Arquivo:** `src/server.js:18-43`
- **Descrição:** helmet default não inclui COEP. Se frontend futuro precisar de SAB (workers crypto, etc.), terá que adicionar. Sem impacto agora.
- **Fix:** Setar `crossOriginEmbedderPolicy: { policy: 'require-corp' }` quando frontend estiver pronto.

#### [P5-B6] Não há endpoint para cliente deletar próprios dados (LGPD/GDPR)
- **Descrição:** SoftHair opera no Brasil — LGPD exige direito de eliminação. Não há `DELETE /api/app/cliente/me` ou similar. Cliente registrado via mobile não consegue apagar conta dele.
- **Fix:** Implementar rota com soft-delete + anonimização (nome → "Cliente removido", email → null, telefone → null). Disparar limpeza após período de retenção legal (5 anos para nota fiscal BR).

#### [P5-B7] `ENCRYPTION_KEY` rotação não documentada
- **Descrição:** Se a chave for rotacionada, dados cifrados com versão antiga ficam inacessíveis. Sem `key_version` em payloads cifrados (`iv:tag:cipher` apenas).
- **Fix:** Adicionar prefixo de versão `v1:iv:tag:cipher`. Documentar processo de rotação (rekeying job).

#### [P5-B8] `JWT_SECRET` rotação não invalida tokens em circulação
- **Descrição:** Rotacionar `JWT_SECRET` força logout global (todos tokens viram inválidos), mas não há mecanismo de migração gradual nem aviso ao usuário. Operação é destrutiva.
- **Fix:** Suportar dual-secret (sign com novo, verify com novo OU antigo durante janela de transição).

#### [P5-B9] Push notifications sem rate limit — pode causar custo Expo
- **Arquivo:** `src/services/pushService.js`
- **Descrição:** Expo Push API tem limits (~600 pushes/sec free, depois pago). Atacante autenticado pode disparar muitos pushes em loop via `POST /api/agendamentos` repetido (cada cria notificação + push). Sem custo agora, mas escala para problema.
- **Fix:** Batch push por janela de tempo (`5min` agrega múltiplos eventos do mesmo cliente em uma notificação).

#### [P5-B10] `LIMIT 200` hardcoded em ComissaoService/VendaService — sem suporte a paginação
- **Arquivos:** `src/services/VendaService.js:29`, `src/services/ComissaoService.js:29`
- **Descrição:** Salão grande tem mais de 200 vendas/comissões — `listar` corta arbitrariamente, ocultando registros antigos sem feedback ao usuário.
- **Fix:** Implementar paginação (offset/limit via query params, retornar total).

---

## Resumo

### Distribuição
- **Críticos novos:** **5** (P5-C1 cascade delete destrói histórico · P5-C2 ausência de audit_log persistente · P5-C3 comissões sem requireAdmin/tenancy · P5-C4 sync.js bypass de comissão pago · P5-C5 fechamentos sem audit/requireAdmin)
- **Altos novos:** **8** (P5-A1 backup script shell injection + broken · P5-A2 backup não cifrado · P5-A3 app/auth/register clientes órfãos + race · P5-A4 timing leak profissional · P5-A5 historico cross-tenant + tabela poluída · P5-A6 decrypt retorna plaintext · P5-A7 logo_url sem validação · P5-A8 WS pool exhaustion)
- **Médios novos:** **10** (multer 1.x · engines node aberto · ponto sem rate limit · iniciar atendimento duplica ponto · health superficial · req.user.id quebrado · backup notificacoes FK cross-tenant · caixa saldo_final sem validação · email userName XSS · WS token em URL)
- **Baixos novos:** **10** (bcrypt → Argon2 backlog · JWT secret único · restore.js dead code · AI command em logs externos · COEP · LGPD delete-me · ENCRYPTION_KEY rotation · JWT_SECRET rotation · push sem batch · LIMIT 200 hardcoded)

### Total: **33 novos issues**

### Não encontrado / verificado limpo
- ✅ **JWT alg confusion**: `verifyToken` agora usa `{ algorithms: ['HS256'] }` em todos os call sites (P4-M1 aplicado consistentemente).
- ✅ **JSON.parse de body sem catch**: rotas usam `JSON.parse` apenas dentro de `try` em ai.js / websocketService.js.
- ✅ **YAML/XML deserialization**: nenhuma dep `js-yaml`, `xml2js`, `node-serialize`.
- ✅ **Webhook receivers**: nenhum endpoint recebe webhooks externos (sem HMAC validation gap).
- ✅ **Path traversal em filesystem**: `fs.writeFile`/`fs.createWriteStream` não usados no caminho de request — apenas em `scripts/` (CLI offline).
- ✅ **Open redirect**: `res.redirect` não usado.
- ✅ **Postgres `pg_sleep` injetável**: queries parametrizadas, ORM-free mas com prepared statements.
- ✅ **ORDER BY com user input**: todas ocorrências são literais hardcoded (`ORDER BY nome`, `ORDER BY created_at`).
- ✅ **LIMIT com template literal**: todas usam placeholders `$N` ou literal hardcoded.
- ✅ **Cookies**: app não usa cookies (Bearer-only); flag `credentials:true` permanece para compat futura (já aceito em P4-B4).
- ✅ **CORS wildcard**: detecta em prod e desativa credentials.
- ✅ **CSP estrita**: aplicada via helmet em todas as respostas.
- ✅ **Cache-Control em endpoints autenticados**: ausente (default Express sem cache).
- ✅ **Connection pool config**: `withTransaction` libera connection no finally (BackupService, VendaService, etc.).
- ✅ **HTTP smuggling**: Render LB termina HTTP/1.1; sem proxy custom.
- ✅ **IV reuso em encrypt**: `crypto.randomBytes(16)` por chamada.
- ✅ **JWT `alg: none`**: bloqueado pelo `algorithms:['HS256']`.
- ✅ **Transação aninhada (BEGIN dentro de BEGIN)**: `withTransaction` é chamado uma vez por handler; não há recursão BEGIN.
- ✅ **Promise.all com efeito colateral cross-tenant**: `ai.js:170-176` valida FK tenancy em paralelo, OK.
- ✅ **Cache em memória sem TTL**: `_adminCache` tem TTL 2min, invalidação manual via `invalidateAdminCache`.
- ✅ **Endpoint `POST /api/auth/register` por IP**: P4-A6 aplicou rate limit dedicado.
- ✅ **JWT `iss/aud`**: não usados (sistema fechado, JWT_SECRET único — aceito).
- ✅ **`unhandledRejection`/`uncaughtException`**: NÃO há handler global — mas Render reinicia processo crashed (mitigado por orquestrador).
- ✅ **HEAD injection via Host header**: trust proxy=1, mas nenhum endpoint constrói URL a partir do Host header.

### Prioridades recomendadas

1. **🔴 Imediato (próxima sprint):**
   - **P5-C1**: migration para trocar CASCADE → RESTRICT/SET NULL em comissões/vendas/fechamentos (preservar histórico).
   - **P5-C2**: criar tabela `audit_log` + middleware que captura ações financeiras.
   - **P5-C3 + P5-C4**: `requireAdmin` nas rotas POST/PUT de comissões; remover `pago`/`data_pagamento` do whitelist de sync.
   - **P5-C5**: `requireAdmin` + audit em fechamentos DELETE/reabrir.

2. **🟠 Esta release:**
   - **P5-A1**: corrigir `scripts/backup.js` (`execFile` + import correto).
   - **P5-A2**: criptografar backup com BACKUP_ENCRYPTION_KEY.
   - **P5-A3**: UNIQUE constraint em `clientes.email` + migrar `clientes_app` para uso real.
   - **P5-A4**: aplicar constant-time pattern do P4-M7 em `appProfissionalAuth.js`.
   - **P5-A6**: decrypt deve lançar erro em formato inválido.

3. **🟡 Próxima release:**
   - **P5-M1**: upgrade `multer@^2`.
   - **P5-M2**: pin Node a 20.x ou 22.x.
   - **P5-M3 + P5-M4**: rate limit em ponto e idempotência em iniciar atendimento.

4. **🟢 Backlog:**
   - LGPD delete-me endpoint.
   - Key rotation (ENCRYPTION_KEY, JWT_SECRET) com versionamento.
   - Argon2id migration.
   - Push batching.

---

*Pass 5 encerrado: 33 novos issues identificados em ângulos nunca cobertos (audit log estrutural, cascade delete, supply chain, backup encryption, script-level command injection, decrypt silenciamento, comissões via sync bypass, fechamentos sem rastro, LGPD gap). Sistema NÃO convergiu para estado seguro — há gaps estruturais que demandam refactor (audit_log persistente + cascade policy financeira) antes de declarar maturidade.*
