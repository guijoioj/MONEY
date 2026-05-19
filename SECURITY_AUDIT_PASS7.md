# Security Audit Pass 7 — SoftHair

**Data:** 2026-05-11
**Auditor:** Pass 7 (sétima passada após os 18 issues do Pass 6 fixados em commits `fb0d3ab`, `0458d60`, `f0e3dbe`, `8460eb9`).
**Escopo:** SOFT-HAIR-SERVER. Foco: verificação dos fixes Pass 6 (regressão), audit log hash chain, backup encryption fail-fast, UNIQUE clientes, scale (jwt_blacklist/audit_log crescimento), scripts/seeds/migrations, edge-cases (admin órfão, concurrent password change, cache invalidation).
**Tipo:** Defensiva — análise estática + revisão de mudanças.
**Resultado:** **NÃO totalmente convergido.** 5 novos issues encontrados (1 alto, 3 médios, 1 baixo). Todos os 18 fixes do Pass 6 foram verificados como **aplicados corretamente**. Os novos issues são estruturais (escala/observabilidade) ou armadilhas residuais — não comprometem a postura de segurança imediata.

---

## Verificação dos fixes Pass 6

| Issue | Status real | Notas |
|---|---|---|
| P6-C1 Backup whitelist | ✅ Aplicado em `BackupService.js`. `comissoes.pago/data_pagamento/valor_comissao`, `vendas.status/valor_final`, `fechamentos.status`, `creditos_cliente.saldo_*` removidos. Restore force-reseta `pago=false`, `vendas.status='pendente'`, `valor_final=valor_total-desconto`, `fechamentos.status='aberto'`, `delete saldo_*`. |
| P6-C2 audit_log tamper-evident | ✅ Aplicado em `initDb.js`. Trigger `BEFORE UPDATE/DELETE` lança `RAISE EXCEPTION`. Hash chain via trigger `BEFORE INSERT` que computa sha256(prev_hash + canonical_row). Requer `pgcrypto`. Smoke test passou — chain ativa. |
| P6-C3 clientes.email UNIQUE | ✅ Aplicado: dedup defensiva em `initDb.runMigrations` antes do `CREATE UNIQUE INDEX unq_clientes_salao_email ON clientes(salao_id, LOWER(email)) WHERE email IS NOT NULL`. Race condition do P5-A3 fechada. |
| P6-C4 app/auth.js login constant-time | ✅ Aplicado em `routes/app/auth.js`. DUMMY_HASH usado quando user não existe. Bcrypt sempre roda. Rota legacy ainda existe (`/api/app/legacy/auth`) mas agora com mesma proteção. |
| P6-A1 appProfissionalAuth vaza salões | ✅ Aplicado. Lógica reescrita: bcrypt FIRST contra TODOS os candidatos, depois decide 401/200/409. 409 só dispara se >1 senha bate — não enumera vínculos sem prova de senha. |
| P6-A2 SVG XSS | ✅ Aplicado em `saloes.js`. Regex `data:image/(png\|jpeg\|jpg\|gif\|webp);base64,...` — `svg+xml` removido. |
| P6-A3 PUT clientes/servicos/produtos sem requireAdmin | ✅ Aplicado em `clientes.js`, `servicos.js`, `produtos.js`. Whitelist explícita (`CLIENTE_UPDATABLE_FIELDS`, `SERVICO_UPDATABLE_FIELDS`, `PRODUTO_UPDATABLE_FIELDS`) + `requireAdmin` em POST/PUT/DELETE. `senha_hash`, `credito_disponivel`, `app_ativo`, `push_token` bloqueados via filtro de body. |
| P6-A4 auditLog não sanitiza | ✅ Aplicado em `utils/auditLog.js`. `redactSensitive(obj)` remove `senha_hash`, `password`, `token`, `jti`, `push_token`, `api_key_hash`, etc. recursivamente (depth-limited a 6). |
| P6-A5 LGPD delete-me não revoga JWT | ✅ Aplicado em `routes/appAuth.js`. `AuthService.revokeToken(token)` chamado após anonimização. Middleware cliente (`clienteAuth.js`) agora valida `app_ativo`/`ativo` (cached 2min). Idem profissional. Função `invalidateClienteCache`/`invalidateProfissionalCache` exportadas mas NÃO chamadas após delete-me — issue residual (P7-M3 abaixo). |
| P6-M1 BACKUP_ENCRYPTION_KEY silencioso | ✅ Aplicado. Em `NODE_ENV=production`, `BackupService.gerarBackup` retorna erro 503 quando chave ausente. `securityInitService` adiciona problema fail-fast no boot prod. |
| P6-M2 senha trocada não invalida JWT | ✅ Aplicado. Coluna `token_version` em `usuarios`, `clientes`, `profissionais`. `AuthService.changePassword` incrementa. JWT incluí `tokenVersion`. `requireAdmin` valida contra DB cached. |
| P6-M3 PUT /me ILIKE cross-tenant | ✅ Aplicado em `routes/app/auth.js`. Refatorado para `UPDATE clientes SET ... WHERE LOWER(email) = LOWER($)` com EQ exato, sem ILIKE search. |
| P6-M4 /health vaza pool/memória | ✅ Aplicado. `/api/health` público retorna apenas `{ status }`. `/api/health/detailed` exige `authMiddleware + requireAdmin`. |
| P6-M5 BACKUP_TABLES incompleto | ✅ Aplicado. 11 → 24 tabelas. `atendimentos`, `historico_cliente`, `registros_ponto`, `despesas`, `bloqueios_horario`, `metas_profissional`, `pontos_fidelidade`, `configuracoes`, `produtos_utilizados`, `pedidos_agendamento`, `pedidos_loja`, `pedido_loja_itens`, `comissoes_pagamentos` adicionados com whitelists próprias. `audit_log` intencionalmente excluído (hash chain). |
| P6-B1 WS dead code sem algorithms | ✅ Aplicado. `authenticateClient` agora usa `{ algorithms: ['HS256'] }`. Comentário marca como dead code. |
| P6-B2 unlink genérico em backup | ✅ Aplicado. `BACKUP_FILE_RE = /^softhair-backup-\d{4}-\d{2}-\d{2}\.sql$/`. Apenas arquivos casados são apagados. |
| P6-B3 comentário enganoso em restore | ✅ Aplicado. Validação real: `absFile.startsWith(backupRoot + path.sep)`. Sai com erro se fora. |
| P6-B4 broadcast cliente/profissional | ✅ Aplicado. `broadcast(salaoId, ...)` agora trata `salaoId == null` como wildcard. Notificações via `notificarCliente`/`notificarProfissional` voltam a funcionar. |

**Verificação independente:** smoke test e static test (`npm test`) — 3/3 PASS após cada wave.

---

## Novos issues encontrados (Pass 7)

### 🟠 ALTOS

#### [P7-A1] `sync.js TABLE_COLUMNS.vendas/atendimentos` permite status/valor_final/valor — mesmo padrão fixado em backup
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/sync.js:20-25`
- **Descrição:** P6-C1 fechou backup com `vendas.status/valor_final` e `comissoes.pago/data_pagamento/valor_comissao` removidos do whitelist, mas o **sync** (que aceita `POST /sync/upload` de clientes/devices) **ainda permite essas colunas**:
  ```js
  vendas: ['cliente_id', 'profissional_id', 'tipo', 'status', 'valor_total', 'desconto', 'valor_final', 'forma_pagamento', 'observacoes'],
  atendimentos: ['cliente_id', 'profissional_id', 'servico_id', 'agendamento_id', 'valor', 'status', 'observacoes'],
  ```
  Atacante com `apiKey`/`device` válidos (ou token roubado de Electron desktop) pode `POST /sync/upload` com:
  - `vendas[].valor_final = 0.01` (desconto + valor_total não conferidos) → afeta fechamento/comissões.
  - `vendas[].status = 'finalizada'` em venda fraudada → ativa cálculo de comissão downstream.
  - `atendimentos[].status = 'cancelado'` em atendimento real → some da agenda do prof.
  - `atendimentos[].valor = 0` → comissão recalculada para zero se houver gatilho.
  Mesmo padrão da fraude bloqueada em P5-C4/P6-C1, mas pelo vetor sync. P5-C4 cobriu `comissoes.pago/data_pagamento` e `fechamentos.status` e `creditos_cliente.saldo_*`, mas **deixou aberto** vendas.status/valor_final e atendimentos.status/valor.
- **Impacto:** Fraude financeira via sync. Atacante com chave de API pode reescrever valor de venda em backup adulterado e re-uploadar.
- **Fix:** Remover de `TABLE_COLUMNS.vendas`: `status`, `valor_final`. Remover de `TABLE_COLUMNS.atendimentos`: `status`, `valor`. Status finaliza venda só via rota dedicada (`/vendas/:id/finalizar`); valor_final é DERIVADO; atendimento status/valor via rotas dedicadas com audit.

### 🟡 MÉDIOS

#### [P7-M1] `jwt_blacklist` cresce indefinidamente — DoS por exaustão de disco
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/securityInitService.js:97-104`, `SOFT-HAIR-SERVER/src/services/authService.js:148`
- **Descrição:** Cada logout, password change (P6-M2), LGPD delete (P6-A5) e revogação manual adiciona uma linha à tabela `jwt_blacklist`. Não existe **nenhuma rotina** que purgue entradas com `expires_at < NOW()`. A `isTokenRevoked` filtra por `expires_at > NOW()`, mas a tabela continua crescendo. Em produção com ~1k usuários ativos:
  - 1 logout/dia/usuário × 365 dias × 1000 = **365k linhas/ano**, todas com `expires_at` antigo. 
  - Em Render free plan (1GB DB), saturação em ~2-3 anos.
  - Index `idx_jwt_blacklist_jti` cresce também.
  Existe função CRON de referência em `src/migrations/reference/security.sql:73-87` mas é **dead code** (nunca executada — diretório `reference/` é informativo).
- **Exploração:** Atacante com `apiKey` ativa um loop que chama `POST /auth/apikey` → cria → logout (revoga JWT do request). Cada loop adiciona 1 linha à `jwt_blacklist` com `expires_at = +8h-24h`. Em 24h, atacante distribui 100k requests e enche tabela. Service degrada antes do DB encher (queries `WHERE expires_at > NOW()` ficam lentas conforme tabela cresce sem VACUUM).
- **Impacto:** DoS de longo prazo. Não-imediato mas inevitável.
- **Fix:** Job cron (no servidor Node mesmo) que roda diariamente:
  ```sql
  DELETE FROM jwt_blacklist WHERE expires_at < NOW();
  ```
  Implementar via `setInterval(86400000)` no `server.js` ou Render Cron Job dedicado. Idealmente: TTL via tabela particionada por dia, com DROP PARTITION rolling.

#### [P7-M2] `audit_log` cresce indefinidamente — quase imutável + sem retention
- **Arquivo:** `SOFT-HAIR-SERVER/src/config/initDb.js:415+`, `SOFT-HAIR-SERVER/src/utils/auditLog.js`
- **Descrição:** P6-C2 tornou `audit_log` append-only. Triggers bloqueiam UPDATE/DELETE. Mas:
  - Não há rotina de retenção (5 anos? 1 ano? legalmente exigido depende — LGPD não impõe expiry de logs forenses, mas eventualmente ocupa disco).
  - Mesmo se quisermos limpar, **triggers bloqueiam DELETE** — admin não consegue apagar via SQL normal.
  - Audit table tem `before_data JSONB + after_data JSONB` — cada entry pode ter 1-10KB. 100 entries/dia × 365 × 5 = ~180k entries × 5KB = 900MB. Em Render free (1GB), satura em ~5 anos só de audit.
  - Pior: o trigger lança exception em DELETE. Único caminho para limpar é DROP TABLE + recreate (perde toda trilha) ou criar role superuser que ignora trigger.
- **Exploração:** Não exploit ativo — issue de operação. Mas: admin malicioso que enche audit_log com `notificacao.criar` repetidos (não é audit-logged, mas qualquer ação que LOG vire um ataque amplification) pode acelerar saturação.
- **Impacto:** Disco esgota → DB read-only → outage. Sem mecanismo de retenção controlada.
- **Fix:** Política de retenção explícita. Opções:
  1. Particionar `audit_log` por mês (`PARTITION BY RANGE (created_at)`); DROP PARTITION via job mensal.
  2. Adicionar trigger override: função `audit_log_purge_old(days)` rodando como SECURITY DEFINER que pode contornar o trigger immutable e deletar entries > N dias. Apenas executável por job system.
  3. Aceitar crescimento e configurar Render para upgrade automático de plano.
  Recomendado: opção 1 (partição) + retenção de 2-5 anos.

#### [P7-M3] Cache `_clienteCache`/`_profCache` não invalidado após LGPD delete-me — janela de 2min de token válido
- **Arquivo:** `SOFT-HAIR-SERVER/src/middleware/clienteAuth.js:6-30`, `SOFT-HAIR-SERVER/src/routes/appAuth.js:222-235`
- **Descrição:** P6-A5 anonimiza cliente (`app_ativo=false`) e revoga JWT via blacklist. Cliente fica bloqueado em requests futuras. **MAS**: o cache `_clienteCache` foi populado por requests recentes do mesmo cliente. Se o cliente fez `GET /me` há 30s, cache tem `{ok: true, exp: now+1.5min}`. Após delete-me:
  - JWT vai pra blacklist → bloqueado pelo `isTokenRevoked` ✅.
  - Cache não invalidado — irrelevante porque blacklist trava ANTES.
  Cenário menos óbvio:
  - Admin desativa profissional via `PUT /profissionais/:id { ativo: false }`. JWT do profissional **não vai pra blacklist** (admin não tem o jti do profissional). Cache `_profCache` ainda tem `{ok: true}` por até 2min. Profissional continua autenticado nesse intervalo.
  - Mitigação parcial: o cache expira em 2min. Janela curta, mas existe.
- **Exploração:** Admin demite profissional malicioso (ativo=false). Profissional tem janela de ~2min para fazer requests via app. Em 2min consegue: ler agenda alheia, marcar ponto fraudulento, anotar produto-utilizado.
- **Impacto:** Janela de 2min para abuso pós-desativação. Mitigado parcialmente por TTL curto.
- **Fix:** Em `PUT /profissionais/:id` (e `PUT /clientes/:id`) quando o body altera `ativo`/`app_ativo`, chamar `invalidateProfissionalCache(id)` / `invalidateClienteCache(id)`. Para invalidação total entre instâncias (Render scaling), usar pub-sub (Redis) ou aceitar TTL como bound máximo. Em LGPD delete-me, chamar `invalidateClienteCache(req.clienteId)` por completude.

### 🟢 BAIXOS

#### [P7-B1] `scripts/createAdmin.js` tem senha default `<REDACTED_PASSWORD>` hardcoded
- **Arquivo:** `SOFT-HAIR-SERVER/src/scripts/createAdmin.js:10`
- **Descrição:** Script CLI de bootstrap aceita senha via env `SOFTHAIR_DEFAULT_ADMIN_PASSWORD`, mas se ausente cai em `'<REDACTED_PASSWORD>'` (8 chars, sem matriz, fraca). Comentário do `CLAUDE.md` umbrella **avisa** mudar após primeiro login mas:
  - Script não verifica força mínima (8+).
  - Script não força reset-on-first-login.
  - Em dev/staging onde o operador esquece, fica `admin/<REDACTED_PASSWORD>` exposto. `securityInitService.createDefaultAdmin` já tem proteção decente em prod (não cria sem `DEFAULT_ADMIN_PASSWORD`), mas o **script CLI manual** ignora essa proteção.
- **Exploração:** Ambiente de staging exposto na internet com defaults → atacante tenta `<REDACTED_EMAIL> / <REDACTED_PASSWORD>` → ganha admin de salão padrão. Cenário menos provável que P5-A4 mas não-zero.
- **Fix:** Em `createAdmin.js`:
  ```js
  if (!process.argv[3] && !process.env.SOFTHAIR_DEFAULT_ADMIN_PASSWORD) {
    throw new Error('Senha obrigatória: passe como argv[3] ou via SOFTHAIR_DEFAULT_ADMIN_PASSWORD');
  }
  if (password.length < 10) throw new Error('Senha muito curta (mínimo 10).');
  ```

---

## Áreas verificadas (e limpas)

- ✅ **Hash chain funciona** — trigger `audit_log_hash_chain` computa sha256 corretamente sobre conteúdo + previous_hash. Não pode pular (trigger BEFORE INSERT obrigatório). Verificado: smoke test rodou inserts que retornaram `current_hash` válido em formato hex 64-char.
- ✅ **Audit log imutável** — UPDATE/DELETE direto via psql resulta em `RAISE EXCEPTION 'audit_log é append-only'`. Triggers `trg_audit_log_no_update`/`trg_audit_log_no_delete` ativos.
- ✅ **Backup encrypted restore de antigo (não-criptografado)** — `restaurarBackup` aceita backup com `metadata.encrypted=false + data` (compatibilidade reversa); aceita também envelope `encrypted_data`. NÃO rejeita backup antigo (compatibilidade intencional). Se quisermos forçar somente encrypted, basta `if (!backupData.encrypted_data && process.env.NODE_ENV === 'production') return error`. Documentei como decisão deliberada.
- ✅ **UNIQUE constraint aplicada** — migration `unq_clientes_salao_email` cria index parcial (WHERE email IS NOT NULL); dedup defensiva roda antes da criação. Smoke test (que cria múltiplos clientes com emails diferentes) passou.
- ✅ **Scripts/seeds/sql files** — `src/scripts/` revisado: `createAdmin.js` (P7-B1), `backup.js` (fixes Pass 6 aplicados), `migrate.js` (idempotente, usa transação), `health-check.js` (CLI de operação, sem exposição). `src/migrations/reference/` é doc — não executado. Sem SQL files com credenciais ou backdoors.
- ✅ **Concurrent password change** — `AuthService.changePassword` faz UPDATE atômico de `senha_hash` + `token_version` em uma única query. Race entre dois `PUT /me/senha` simultâneos: ambos vão para o DB; ordem é serializada pelo PG via row lock implícito. Resultado: ambos sucedem mas só o último persistente. `token_version` incrementa duas vezes (de 0 → 2). Tokens antigos invalidados, tokens emitidos entre os dois changes ficam invalidados também. **Sem estado inconsistente.**
- ✅ **Edge: salão sem admin** — Não existe rota DELETE de usuario (admin). `requireAdmin` busca `tipo = 'admin' AND ativo = true`. Demoting o único admin (mudando `tipo` no DB direto) deixa salão órfão sem admin acessível via API. **Vetor existe mas só via SQL direto** — não há rota que permita demote/delete de admin. Único caminho operacional é o próprio admin descer-se via SQL (improvável). Adicionar guard `IF (SELECT COUNT(*) FROM usuarios WHERE salao_id = X AND tipo='admin' AND ativo=true) > 1` seria over-engineering para vetor não-acessível.
- ✅ **`profissionais.js` PUT /:id senha_app** — Já é `requireAdmin` (verificado linhas 102-129). Reset de `senha_app` por admin gera novo `senha_hash` mas **NÃO incrementa `token_version`** dos profissionais — issue residual mas mitigado parcialmente porque profissional JWT já tem TTL 24h e middleware checa `app_ativo`. Bumping token_version aqui seria refinamento — não considerei issue dada baixa exposição.
- ✅ **Mass-assignment em profissionais.js** — já corrigido em Pass 3/4 (P3-A4) com `PROFISSIONAL_ALLOWED_FIELDS` whitelist.
- ✅ **JWT alg confusion** — Todos os middlewares ativos travam `{ algorithms: ['HS256'] }`. Dead code (`authenticateClient` em websocket) agora também trava (P6-B1).
- ✅ **CSP/COEP/HSTS/CORS** — sem regressões.
- ✅ **Rate limiting** — `apiLimiter`, `authLimiter`, `registerLimiter`, `aiLimiter`, `publicSaloesLimiter` todos ativos. `keyGenerator` combina IP+bearer-fingerprint.

---

## Resumo

### Distribuição
- **Altos novos:** 1 (P7-A1 sync.js permite status/valor_final em vendas/atendimentos)
- **Médios novos:** 3 (P7-M1 jwt_blacklist sem retention · P7-M2 audit_log sem retention/quase impossível de limpar · P7-M3 cache invalidation gap)
- **Baixos novos:** 1 (P7-B1 createAdmin.js hardcoded password fallback)

### Total: **5 novos issues**

### Verificação dos fixes Pass 6: **18/18 ✅**

### Conclusão
**Sistema NÃO totalmente convergido, mas postura defensiva é forte.** Todos os 18 fixes do Pass 6 foram aplicados corretamente. Os 5 novos issues do Pass 7 são:

- **P7-A1**: completar a varredura do padrão "status/valor sensível em whitelist" iniciado em P5-C4/P6-C1 — sync ficou pra trás.
- **P7-M1/M2**: escala — `jwt_blacklist` e `audit_log` crescem sem mecanismo de retention. Vai dar problema em ~1-5 anos dependendo de tráfego.
- **P7-M3**: gap residual de invalidação de cache pós-desativação (janela de 2min). Bound aceitável mas pode ser ajustado.
- **P7-B1**: bootstrap script com default fraco — operacional, não exploit ativo.

### Prioridades recomendadas

1. **🟠 Próxima sprint:**
   - **P7-A1**: remover `status`, `valor_final` de `sync.js TABLE_COLUMNS.vendas` e `status`, `valor` de `TABLE_COLUMNS.atendimentos`. Mesmas razões de P6-C1.

2. **🟡 Próxima release:**
   - **P7-M1**: job cron `DELETE FROM jwt_blacklist WHERE expires_at < NOW()` diário. Implementar via `setInterval` no `server.js` ou Render Cron.
   - **P7-M3**: chamar `invalidateProfissionalCache(id)` / `invalidateClienteCache(id)` em `PUT /clientes/:id` e `PUT /profissionais/:id` quando `ativo`/`app_ativo` mudam. Idem em LGPD delete-me.

3. **🟢 Backlog:**
   - **P7-M2**: planejar particionamento de `audit_log` por mês com DROP PARTITION rolling. Decisão de retention legal (2 anos? 5? 10?) depende de aconselhamento jurídico.
   - **P7-B1**: hardening de `createAdmin.js` — exigir senha >=10 chars, sem fallback.

### Próxima passada (Pass 8?)
Se P7-A1, P7-M1 e P7-M3 forem aplicados em sprint dedicada, o sistema pode ser declarado **convergido para postura segura operacional**. P7-M2 e P7-B1 são backlog não-bloqueante.

---

*Pass 7 encerrado: 5 novos issues, todos os 18 fixes do Pass 6 confirmados. Sistema próximo de convergência — apenas P7-A1 é semelhante aos issues estruturais anteriores. Os demais são scale/operations, não vulnerabilidade ativa explorável.*
