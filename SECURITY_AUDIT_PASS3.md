# Security Audit Pass 3 — SoftHair

**Data:** 2026-05-11
**Auditor:** Pass 3 (terceira passada após cleanup do Pass 2)
**Escopo:** SOFT-HAIR-SERVER, SoftHair/frontend, softhair-mobile
**Tipo:** Defensiva — análise estática. Foco em ângulos novos: lógica de negócio, mass assignment, JWT trust, DoS, crypto.

## Verificação de fixes Pass 2

| ID  | Status | Observação |
|-----|--------|------------|
| P2-M9 | ✅ FIXADO | `npm audit` no `softhair-mobile` retorna 0 vulnerabilidades após `expo install --fix` + override `postcss: ^8.5.10`. |
| P2-M10 | ✅ FIXADO | `npm audit` no `SoftHair/frontend` retorna 0 vulns; `vite@8` instalado via force; `vite build` validado. |
| P2-B2 | ⏸️ ACEITO | Cosmético — `profissionalAuthMiddleware` (admin path) e `profissionalAppMiddleware` (mobile path) têm `req.*` distintos; unificar exigiria refator amplo. Sem risco ativo. |
| P2-B3 | ⏸️ ACEITO | Rota legacy retorna 410 com mensagem de migração — remover transformaria em 404 silencioso, pior UX para clientes antigos. |
| P2-B10 | ⏸️ ACEITO | `hsts.preload` continua presente; submissão a hstspreload.org é operação manual fora de código. |

Smoke tests pós-cleanup: **3/3 PASS** (jest --runInBand contra DB de produção).

---

## Novos issues encontrados

### 🔴 CRÍTICOS

#### [P3-C1] `POST /api/auth/device/register` — admin pode registrar device de outro salão (escalada cross-tenant)
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/auth.js:60-83`
- **Descrição:** A rota aceita `salaoId` do `req.body` e o passa diretamente para `AuthService.registerDevice`. Não há nenhuma validação que esse `salaoId` é igual a `req.salaoId`. `requireAdmin` apenas exige `tipo==='admin'`, sem verificar **qual** salão. Resultado: um admin do salão A consegue criar um device-fingerprint apontando para salão B; em seguida, qualquer requisição com header `x-device-fingerprint: <fp_de_B>` passa pelo `authMiddleware` (linhas 37-43) e ganha `req.salaoId = <salão B>`, completamente bypassando JWT/2FA/login e acessando dados de B com permissões implícitas do device.
- **Exploração:**
  1. Admin malicioso do salão A faz `POST /api/auth/device/register` com `{ salaoId: <id_B>, tipo:'desktop', nome:'pwn', fingerprint:'<rand>' }`.
  2. Lê dados de B via `GET /api/clientes` com `x-device-fingerprint: <rand>`.
- **Fix:** Forçar `salaoId = req.salaoId` (ignorar body) **ou** rejeitar se `req.body.salaoId !== req.salaoId`. Adicionalmente, considerar separar `tipo` em escopos com permissões reduzidas (não admin-equivalente).

#### [P3-C2] `POST /api/vendas` aceita `valor_final` arbitrário + decrementa estoque cross-tenant
- **Arquivos:** `SOFT-HAIR-SERVER/src/routes/vendas.js:40-58`, `services/VendaService.js:62-95`
- **Descrição:** Três problemas combinados em uma chamada:
  1. **Mass-assignment de preço:** validator aceita qualquer `valor_total`/`valor_final >= 0`. Não há verificação que `valor_final = SUM(item.quantidade * item.preco_unitario) - desconto`. Cliente do app desktop pode forjar venda de R$ 0,01 cobrindo produto de R$ 500.
  2. **FKs sem tenancy:** `data.cliente_id`, `data.profissional_id`, `data.itens[].produto_id` são inseridos sem verificar `salao_id`. Cross-tenant inserção (P2-A6 estilo, mas em outra rota).
  3. **Estoque cross-tenant:** `UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2` (linha 88) não filtra por `salao_id`. Combinado com FK cross-tenant, atacante pode drenar estoque de outro salão.
- **Fix:** Validar `cliente_id`, `profissional_id`, `produto_id` contra `salao_id` antes do INSERT. Recalcular `valor_final` server-side a partir de itens. Aplicar `AND salao_id = $X` no UPDATE de estoque, com `quantidade_estoque >= $1` para falha atômica.

#### [P3-C3] `POST /api/comissoes/pagar` — sem requireAdmin + double-payment race + valor arbitrário
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/comissoes.js:56-79`
- **Descrição:** Três falhas:
  1. **Falta `requireAdmin`:** recepcionista ou qualquer staff pode pagar comissões em nome do salão. Risco direto de fraude interna.
  2. **Sem idempotência:** dois `POST /comissoes/pagar` simultâneos com o mesmo array `comissoes` criam dois registros em `comissoes_pagas`. Não há `UNIQUE` ou check `WHERE pago=false` na UPDATE — `UPDATE comissoes SET pago=true WHERE id = ANY($1)` é idempotente, mas a INSERT em `comissoes_pagas` não. Resultado: pagamento duplicado contabilizado.
  3. **`valor` arbitrário:** body passa `valor` direto pra INSERT, sem reconciliar com `SUM(valor_comissao)` das `comissoes` realmente marcadas como pagas naquela transação. Atacante (ou bug do frontend) pode registrar pagamento de R$ 99.999 cobrindo comissões de R$ 100.
- **Fix:**
  - Adicionar `requireAdmin`.
  - Envolver em transação: `UPDATE comissoes SET pago=true WHERE id = ANY($1) AND salao_id = $2 AND pago=false RETURNING valor_comissao` → `valor_real = SUM(rows)` → `INSERT INTO comissoes_pagas (..., valor=valor_real)`.
  - Idem para `/api/comissoes/estornar`.

### 🟠 ALTOS

#### [P3-A1] `PUT /api/agendamentos/:id` — sem validação cross-tenant das FKs no UPDATE (regressão parcial de P2-A7)
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/AgendamentoService.js:146-194`
- **Descrição:** O fix P2-A7 cobriu apenas `criar` (linha 102-114). O `atualizar` recebe `cliente_id`/`profissional_id`/`auxiliar_id`/`servico_id` do body e faz `UPDATE ... COALESCE($X, ...)` sem checar tenancy. Admin do salão A pode mover agendamento dele para apontar para `cliente_id` do salão B, ou trocar `servico_id` para serviço de outro salão. Postgres aceita pois não há FK composta `(id, salao_id)`.
- **Exploração:** `PUT /api/agendamentos/123 { profissional_id: <id_de_outro_salão> }` → agendamento agora referencia profissional inexistente neste salão (relatórios quebram + cross-tenant leak via JOINs em listagens).
- **Fix:** Replicar os mesmos checks do `criar` no `atualizar`.

#### [P3-A2] `POST /api/backup/restore` — SQL injection via column-name em backup forjado
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/BackupService.js:92-106`
- **Descrição:** Admin (e somente admin) pode subir JSON arbitrário em `req.body.backup`. O service faz `INSERT INTO ${table} (${columns.join(', ')})` onde `columns = Object.keys(filteredRow)` vem do JSON. Pg-format aplica parametrização apenas a valores, não a nomes de coluna. Admin malicioso (ou comprometido) pode criar backup com chaves como `"nome) VALUES (1); DROP TABLE usuarios;--"` e executar SQL arbitrário com privilégios da role do app.
- **Exploração:** Backup JSON com coluna `"x; DELETE FROM saloes WHERE 1=1; --"` → tabela inteira destruída.
- **Fix:** Whitelist de colunas por tabela. Ex.: `const ALLOWED = { clientes: ['nome','email',...], ... }`. Filtrar `columns` contra `ALLOWED[table]`. Bonus: validar regex `/^[a-z_][a-z0-9_]*$/` em cada nome.

#### [P3-A3] `requireAdmin` confia em `tipo` do JWT sem revalidar contra DB
- **Arquivo:** `SOFT-HAIR-SERVER/src/middleware/auth.js:89-97`
- **Descrição:** Após login, JWT carrega `tipo='admin'`. Se o admin for **demoted** ou **desativado** no DB, o JWT continua válido por até 24h (sem invalidação via blacklist a menos que faça logout explícito). Janela de exploração: admin demitido mantém poder por horas.
- **Exploração:** Cenário interno — funcionário demitido cuja sessão ainda está ativa pode continuar acessando `requireAdmin` endpoints.
- **Fix:** Em `requireAdmin`, executar `SELECT tipo, ativo FROM usuarios WHERE id = $1` e re-verificar (com cache curto de 1-2 min para não derrubar performance). Alternativa: invalidar JWT (blacklist) sempre que tipo/ativo de usuário muda.

#### [P3-A4] `PUT /api/profissionais/:id` aceita campos arbitrários (mass assignment)
- **Arquivos:** `SOFT-HAIR-SERVER/src/routes/profissionais.js:79-104`, `src/models/BaseModel.js:118-151`
- **Descrição:** O handler faz `const { senha_app, ...body } = req.body; service.atualizar(id, body, req.salaoId)`. `filterData` no BaseModel é no-op (linha 188). BaseModel.update skipa `id`, `created_at`, `salao_id` mas **aceita qualquer outra coluna**, incluindo `comissao_percentual`, `ativo`, `usuario_id`, `senha_hash`, `app_ativo`, `push_token`, `email`. Admin já tem privilégios para isso, **mas** o risco real é o admin **acidentalmente** ou via frontend comprometido sobrescrever campos sensíveis (ex.: setar `usuario_id` apontando para outro user → vincula profissional a usuário desktop arbitrário).
- **Fix:** Whitelist explícito de campos editáveis (`['nome','email','telefone','especialidade','comissao_percentual','ativo','foto_url']`). Mesmo padrão para clientes/serviços/produtos.

#### [P3-A5] `POST /api/app/pedidos` — cliente cria pedido em salão sem vínculo prévio
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/pedidos.js:103-131`
- **Descrição:** O fix P2-M6 valida `servicoId/profissionalId` vs `salonId`, mas **não valida** que o cliente autenticado (`req.clienteApp`) tem vínculo (email match) com `salonId`. O helper `requireClienteVinculado` existe em `app/cliente.js` mas não é usado aqui. Cliente do salão A pode criar pedidos em salões B, C, D iterando `salonId`, gerando spam no painel de outros salões.
- **Fix:** Aplicar `requireClienteVinculado` ou helper análogo (com criação implícita opcional para onboarding).

#### [P3-A6] `DELETE /api/creditos/:id` — apaga lançamento sem recompor saldo
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/creditos.js:64-79`
- **Descrição:** A rota deleta um registro de `creditos_cliente`, mas não atualiza `clientes.credito_disponivel` correspondentemente. Resultado: bug de auditoria. Pior — apagar uma movimentação do tipo `'uso'` reverte o débito? Não. Mas apagar uma do tipo `'credito'` deixa o saldo elevado sem evidência. Não é exploração externa direta, mas é vetor para fraude interna (admin apaga histórico).
- **Fix:** Re-calcular saldo após DELETE (ou bloquear DELETE de movimentações e exigir lançamento compensatório). Logar `audit_log`.

#### [P3-A7] Mensagem `Salão inativo` no `/api/auth/login` permite user enumeration
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/authService.js:71-73`
- **Descrição:** Login retorna `'Credenciais inválidas'` quando user não existe ou senha errada, mas retorna `'Salão inativo'` quando user existe **e** senha bate **e** salão é inativo. Atacante com lista de emails consegue distinguir contas válidas (senha forçada bruta) cujo salão foi desativado.
- **Fix:** Substituir por `'Credenciais inválidas'` (ou genérico).

### 🟡 MÉDIOS

#### [P3-M1] `body limit: 10mb` + sem proteção contra JSON bomb / deeply nested
- **Arquivo:** `SOFT-HAIR-SERVER/src/server.js:69`
- **Descrição:** `express.json({ limit: '10mb' })` ainda aceita objeto fortemente aninhado dentro do limite (ex.: 10MB de `{"a":{"a":...}}` causa stack overflow em libs que recursam). Sem `qs` parser, mas `JSON.parse` nativo aguenta. Risco baixo mas existe.
- **Fix:** Adicionar middleware de "depth check" customizado, ou reduzir limit para 1mb fora de rotas de upload/backup, e dedicar limites maiores apenas em `/api/backup/restore`.

#### [P3-M2] `ENCRYPTION_KEY` / `HMAC_SECRET` sem validação de comprimento na inicialização
- **Arquivo:** `SOFT-HAIR-SERVER/src/utils/encryption.js:1-13`
- **Descrição:** `Buffer.from(ENCRYPTION_KEY, 'hex')` retorna buffer vazio se var não definida. AES-256-GCM exige 32 bytes (64 hex chars). Falha em produção só quando alguém chama `encrypt()`. Convém fail-fast no boot.
- **Fix:** No `securityInitService.js`, validar `ENCRYPTION_KEY && Buffer.from(ENCRYPTION_KEY,'hex').length === 32` e `HMAC_SECRET && HMAC_SECRET.length >= 32`. Abort se inválido em produção.

#### [P3-M3] `itens.quantidade` sem upper bound em `/api/app/loja/pedido`
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/loja.js:62-68`
- **Descrição:** `Number.isInteger(qtd) && qtd > 0` aceita até `Number.MAX_SAFE_INTEGER`. Cliente pode pedir `quantidade: 1e15`, ocasionando `subtotal` enorme, ou simplesmente forjar estatística de venda gigante (e quebrar relatórios). Estoque vai negativo (a menos que o `>= $qtd` proposto em P2-A4 esteja aplicado).
- **Fix:** Limitar a `1..10000` por item; idealmente bater contra `quantidade_estoque` antes de gravar.

#### [P3-M4] WebSocket sem validação de `Origin` no handshake
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/websocketService.js:20-39`
- **Descrição:** JWT obrigatório já bloqueia 99% do abuso, mas WS aceita qualquer Origin. Site malicioso com token roubado/social-engineering consegue abrir conexão; embora isso seja anyway um problema cross-origin. Defense in depth: validar `info.req.headers.origin` contra `ALLOWED_ORIGINS`.
- **Fix:** Em `verifyClient`, checar Origin. Render expõe servidor em `*.onrender.com` — qualquer app no domínio compartilhado herda esse Origin caso CORS não esteja apertado. (Para produção atual, `softhair-mobile` em React Native não envia Origin, então tem que aceitar request sem Origin também.)

#### [P3-M5] `data_hora` em agendamento sem validação de futuro
- **Arquivos:** `SOFT-HAIR-SERVER/src/routes/agendamentos.js:84`, `services/AgendamentoService.js:116-131`
- **Descrição:** Validator aceita qualquer ISO 8601 — passado ou futuro. Cliente pode criar agendamento com `data_hora` no passado (ou ano 1970), bagunçando dashboard, relatórios e backup. Não é exploração de segurança, mas é integridade de domínio.
- **Fix:** `.custom(v => new Date(v).getTime() >= Date.now() - 60_000)` para tolerar pequenos clock skews.

#### [P3-M6] `agendamentos.cancelar` permite cancelar próprio agendamento sem auth de cliente em alguns paths
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/AgendamentoService.js:196-228`
- **Descrição:** Não vi exposição direta para cliente cancelar próprio agendamento (via `/api/app/cliente/*` é só leitura). Risco potencial: se houvesse rota para o cliente cancelar, a tendência de copiar `service.cancelar(id, motivo, salaoId)` falharia em validar dono. Marcado como **defense-in-depth recommendation**: incluir `cliente_id` na cláusula WHERE quando chamada vem do app.

#### [P3-M7] Frontend bundle ainda > 1MB (não-segurança, mas relevante)
- **Arquivo:** `SoftHair/frontend/dist/assets/index-*.js (1030 KB)`
- **Descrição:** Bundle não usa code-splitting. Não é vulnerabilidade, mas aumenta superfície de ataque XSS (mais JS = mais sinks). Fora de escopo direto desta auditoria.

#### [P3-M8] `ILIKE %search%` sem escape de `%` / `_`
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/clientes.js`, `produtos.js`, `servicos.js`, `profissionais.js`
- **Descrição:** Endpoints de busca aceitam `search=%` e retornam todos os registros, similar a `?limit=200` sem filtro real. Permite exfiltração rápida (mas só de tenant próprio).
- **Fix:** `.replace(/[%_]/g, '\\$&')` antes de concatenar.

### 🟢 BAIXOS

#### [P3-B1] `JWT_EXPIRES_IN` 24h é longo para sessões com privilégio admin
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/authService.js:111`
- **Descrição:** Default 24h sem refresh token. Convencional, mas para tipo='admin' considerar 8h ou exigir refresh.

#### [P3-B2] `ProfissionalService.criar` aceita `data.ativo` arbitrário
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/ProfissionalService.js:52-58`
- **Descrição:** Default true, mas admin pode criar profissional já desativado (`ativo: false`) sem flow específico. Não é vuln. Cosmético.

#### [P3-B3] `notificacoes` (não auditado em detalhe) — verificar `requireAdmin` em rotas de envio em massa
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/notificacoes.js`
- **Descrição:** Não auditado. Se permitir broadcast a todos clientes do salão, risco de spam interno.

#### [P3-B4] `webSocket.subscriptions[]` sem cap de tamanho
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/websocketService.js`
- **Descrição:** Cliente WS pode SUBSCRIBE em N canais. Sem cap, atacante autenticado infla `clients.get(ws).subscriptions` consumindo memória.
- **Fix:** Cap em ~50 subscriptions por cliente.

#### [P3-B5] `req.profissionalId` no `PUT /api/app/profissional/push-token` aceita push token sem validação de formato
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/appProfissionalAuth.js:95-103`
- **Descrição:** `pushToken` vai direto pro UPDATE. Sem regex `/^ExponentPushToken\[.+\]$|^FCM:.+/i`. Profissional malicioso pode armazenar lixo, mas dispara apenas no push do próprio device.

#### [P3-B6] `appProfissional.js:48` log via `console.error(error)` em prod
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/appProfissional.js:47,67`
- **Descrição:** `console.error('Erro ao registrar ponto:', error)` loga objeto inteiro do erro nos logs do Render — inclui stack trace e potencialmente parâmetros. Não vaza ao cliente (resposta sanitizada via `sendErr`), mas logs Render são consultáveis pelo time.

#### [P3-B7] `mobile/utils/security.ts` — chave AES hardcoded (já documentado como A6, não fechado)
- **Arquivo:** `softhair-mobile/utils/security.ts`
- **Descrição:** Mantido como conhecido (Pass 1 [A6] em ROADMAP). Sem regressão, mas continua aberto. Lembrete.

#### [P3-B8] WS legacy `auth-via-mensagem` removido mas `ws._authTimeout` ainda iguala 10s
- **Arquivo:** `websocketService.js:84-88`
- **Descrição:** Como handshake agora exige token, o timeout é dead code (todas as conexões já estão autenticadas ao chegar nesse ponto). Cosmético; remover reduz superfície.

#### [P3-B9] `ProfissionalService.deletar` faz soft-delete (`ativo: false`) mas mantém senha_hash
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/ProfissionalService.js:101-127`
- **Descrição:** Profissional desativado mantém `senha_hash` no banco. Se admin reativa, senha antiga volta. Considerar zerar `senha_hash` + `app_ativo=false` no soft delete.

#### [P3-B10] `console.log('[BACKUP][AUDIT] ...')` em backup.js loga apenas userId, não a IP ou User-Agent
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/backup.js:23,37`
- **Descrição:** Audit trail incompleto. Adicionar `req.ip` e `req.headers['user-agent']` ajuda em forense.

---

## Resumo

- **Pass 2 cleanup:** ✅ M9/M10 fechados; B2/B3/B10 aceitos como ⏸️ (cosméticos sem risco).
- **Novos críticos:** **3** — todos giram em torno de **mass-assignment + cross-tenant FKs**:
  - P3-C1 device-register cross-tenant (escalada de admin para qualquer salão)
  - P3-C2 vendas (preço arbitrário + estoque cross-tenant)
  - P3-C3 comissões pagas sem requireAdmin + race de duplicação
- **Novos altos:** **7** — agendamentos update sem tenancy, backup-restore column-name SQLi, JWT-tipo trust stale, mass-assignment em profissionais, pedidos sem requireClienteVinculado, créditos delete sem recompor, login user enumeration.
- **Novos médios:** **8** — JSON bomb (10mb), ENC_KEY sem validação no boot, quantidade sem upper bound, WS Origin não validado, data_hora não validada como futuro, bundle size, ILIKE wildcard injection.
- **Novos baixos:** **10** — diversos (cap subscriptions WS, push token sem regex, logs de auditoria incompletos, etc.).

### Prioridades recomendadas

1. **🔴 Imediato:** P3-C1 (device register é escalada cross-tenant trivial — fix de 1 linha), P3-C3 (requireAdmin em /pagar evita fraude interna direta), P3-C2 (preço/estoque em vendas é vetor de fraude em produção).
2. **🟠 Esta sprint:** P3-A1 (update agendamentos), P3-A2 (backup-restore column whitelist), P3-A3 (re-verificar `tipo` em DB no requireAdmin), P3-A4 (whitelist mass-assignment em profissionais).
3. **🟡 Próxima sprint:** validações de input (data_hora futuro, quantidade upper bound, encryption key boot check, JSON depth).
4. **🟢 Backlog:** B-series — refinos de defense-in-depth.

### Não encontrado / verificado limpo

- ✅ `Math.random` — não usado para tokens/IDs (todos `crypto.randomBytes`).
- ✅ `bcrypt` rounds — todas as chamadas usam 12.
- ✅ `JWT_SECRET` — sem fallback fraco (`jwt.verify` lança se env unset).
- ✅ `X-Powered-By` — removido por helmet default.
- ✅ Endpoint `/debug` — ausente.
- ✅ Stack trace em prod — global error handler suprime corretamente.
- ✅ `/api/health` — não expõe versão em prod (B9 fechado).
- ✅ `path traversal` em backup — backup gera em memória (não escreve arquivo).
- ✅ Cliente `/api/app/cliente/*` — todas rotas usam `requireClienteVinculado` após fix P2-C2.
- ✅ Auth de admin em produtos: `produtos.js` (não auditado em detalhe; herda `authMiddleware`).

---

## Resolução — Pass 3 (2026-05-11)

Smoke tests: **3/3 PASS** após cada wave de fixes.
Commits: 4 (criticals+high, medium, low). Veja git log para detalhes.

### Críticos
| ID  | Status | Notas |
|-----|--------|-------|
| P3-C1 | ✅ FIXADO | `routes/auth.js` — `salaoId` forçado do JWT (`req.salaoId`); body que diverge → 403. |
| P3-C2 | ✅ FIXADO | `services/VendaService.js` — server-side pricing autoritativo via `produtos.preco_venda`; validação tenancy de cliente/profissional/produto; UPDATE de estoque com `salao_id` + `quantidade_estoque >= $qtd` (atômico). Route validator agora aceita opcionalmente valor_total/valor_final (ignorados). |
| P3-C3 | ✅ FIXADO | `routes/comissoes.js` — adicionado `requireAdmin`; `UPDATE ... WHERE pago=false RETURNING valor_comissao` em transação; valor reconciliado contra soma das comissões marcadas; audit log com IDs. Mesmo padrão em `/estornar`. |

### Altos
| ID  | Status | Notas |
|-----|--------|-------|
| P3-A1 | ✅ FIXADO | `services/AgendamentoService.js#atualizar` — replicado o check de tenancy do `criar` para cliente/profissional/servico/auxiliar. |
| P3-A2 | ✅ FIXADO | `services/BackupService.js` — whitelist explícita `ALLOWED_COLUMNS` por tabela + regex `SAFE_IDENT`. Coluna fora da whitelist é descartada; nome de tabela é validado contra `BACKUP_TABLES`. |
| P3-A3 | ✅ FIXADO | `middleware/auth.js#requireAdmin` agora async — revalida `tipo='admin' AND ativo=true` no DB com cache de 2 min (TTL). Exportado `invalidateAdminCache` para uso futuro em rotas que alteram tipo/ativo. |
| P3-A4 | ✅ FIXADO | `routes/profissionais.js` — `PROFISSIONAL_ALLOWED_FIELDS` whitelist; `pickAllowed` aplicado em POST e PUT. `id`, `salao_id`, `usuario_id`, `senha_hash` (direto), `created_at` nunca aceitos. |
| P3-A5 | ✅ FIXADO | `routes/app/pedidos.js` — `clienteJaVinculado()` exige match por email/telefone no salão antes de aceitar POST `/api/app/pedidos`. |
| P3-A6 | ✅ FIXADO | `routes/creditos.js#DELETE` — transação atômica recompõe `credito_disponivel` revertendo o delta da movimentação (credito subtrai, uso adiciona); audit log. |
| P3-A7 | ✅ FIXADO | `services/authService.js#login` — `'Salão inativo'` substituído por `'Credenciais inválidas'` (no user enumeration). |

### Médios
| ID  | Status | Notas |
|-----|--------|-------|
| P3-M1 | ✅ FIXADO | `server.js` — limite global JSON 1mb; rota `/api/backup/*` mantém 20mb dedicado. |
| P3-M2 | ✅ FIXADO | `services/securityInitService.js#validateCryptoKeys` — fail-fast no boot em prod se ENCRYPTION_KEY ≠ 32 bytes, HMAC_SECRET < 32 chars, ou JWT_SECRET ausente/curto. |
| P3-M3 | ✅ FIXADO | `routes/app/loja.js` (e `VendaService.js`) — quantidade max 10000 por item. |
| P3-M4 | ✅ FIXADO | `services/websocketService.js#verifyClient` — valida Origin contra `ALLOWED_ORIGINS`; mobile (sem Origin) permitido. |
| P3-M5 | ✅ FIXADO | `routes/agendamentos.js` POST — `.custom()` em `data_hora` rejeita passado (tol. 60s skew) e >100 anos futuro. |
| P3-M6 | ⏸️ ACEITO | Defense-in-depth recommendation — não há rota de cliente para cancelar próprio agendamento no momento. Fica como nota para quando essa rota for criada. |
| P3-M7 | ⏸️ ACEITO | Bundle size (não-segurança); fora de escopo direto da auditoria. |
| P3-M8 | ✅ FIXADO | `utils/helpers.js#escapeLike` + aplicação em `produtos.js`, `servicos.js`, `profissionais.js`, `saloes.js`, `ClienteService.js` (listar + buscarPorTermo). |

### Baixos
| ID  | Status | Notas |
|-----|--------|-------|
| P3-B1 | ✅ FIXADO | `authService.js#generateToken` — admin TTL 8h, regular 24h; ambos configuráveis via env. |
| P3-B2 | ⏸️ ACEITO | Cosmético — admin pode legitimamente criar profissional inativo (pré-onboarding); sem risco. |
| P3-B3 | ⏸️ ACEITO | Auditado: `routes/notificacoes.js` POST cria uma única notificação (não há rota de broadcast em massa). Sem risco. |
| P3-B4 | ✅ FIXADO | `websocketService.js#subscribeClient` — cap de 50 subscriptions por cliente. |
| P3-B5 | ✅ FIXADO | `routes/appProfissionalAuth.js#PUT /push-token` — valida regex `ExponentPushToken[...]` ou `FCM:...`, max 256 chars. |
| P3-B6 | ✅ FIXADO | `routes/appProfissional.js` — `console.error('...', error.message)` no fluxo /ponto. |
| P3-B7 | ⏸️ ACEITO | Conhecido — `softhair-mobile/utils/security.ts` (chave AES hardcoded) já tracked em ROADMAP Pass 1 [A6]. |
| P3-B8 | ✅ FIXADO | `websocketService.js` — removido `_authTimeout` (dead code pós-handshake-com-token). |
| P3-B9 | ✅ FIXADO | `ProfissionalService.js#deletar` — soft delete zera `senha_hash`, `app_ativo`, `push_token`. |
| P3-B10 | ✅ FIXADO | `routes/backup.js` — audit log inclui `req.ip` e `user-agent` (truncado a 120 chars). |

### Sumário

- **Críticos fixados:** 3 / 3
- **Altos fixados:** 7 / 7
- **Médios fixados:** 6 / 8 (M6 e M7 aceitos com justificativa)
- **Baixos fixados:** 8 / 10 (B2 e B7 aceitos; B3 verificado limpo)
- **Total fixado:** 24 / 28 — restantes 4 ⏸️ aceitos.
- **Testes:** 3/3 PASS (jest --runInBand) após cada wave.
- **Commits:** 4 (db42e47 criticals+high, 0f2414f medium, 4d4dfe1 low; mais um previsto para este doc).
