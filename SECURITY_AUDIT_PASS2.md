# Security Audit Pass 2 — SoftHair

**Data:** 2026-05-11
**Auditor:** Pass 2 (segunda passada após fixes da pass 1)
**Escopo:** SOFT-HAIR-SERVER, SoftHair/frontend, softhair-mobile
**Tipo:** Defensiva — análise estática

---

## Regressões dos fixes anteriores

| ID  | Status | Observação |
|-----|--------|------------|
| C1  | ✅ OK | `securityInitService.js` bloqueia admin default em prod sem `DEFAULT_ADMIN_PASSWORD`. |
| C2  | ⚠️ PARCIAL | `resolverCliente` usa email exato — mas helper `requireClienteVinculado` foi declarado e NÃO É USADO em nenhuma rota (todas as rotas só `resolverCliente` + retorno vazio). Ver R1. |
| C3  | ⚠️ PARCIAL | Maioria das queries em `appProfissional.js` agora tem `salao_id`. Porém `POST /ponto` (linha 48) ainda vaza `error.message` em prod. Sem regressão de tenancy. |
| C4  | ✅ OK | Senha admin agora exige 8+ chars + complexidade. |
| C5  | ✅ OK | `server.js:50-53` rejeita `*` + credentials em prod. |
| A1  | ⏳ PARCIAL (já doc) | CSP endurecida; token ainda em localStorage (decisão consciente, ROADMAP). |
| A2  | ⚠️ PARCIAL | `jwt_blacklist` só é consultada por `authMiddleware` (admin). `appAuthMiddleware`, `clienteAuthMiddleware`, `profissionalAuthMiddleware` NÃO verificam blacklist — logout de cliente/profissional não revoga token. Ver R2. |
| A3  | ✅ OK | `decoded.type === 'cliente'` exigido estritamente. |
| A4  | ✅ OK | AI valida IDs, action whitelisted, tenant-checked. |
| A5  | ⏳ PARCIAL (já doc) | `unsafe-inline` em styleSrc ainda presente (Tailwind). |
| A6  | ⏳ PENDENTE (já doc) | Chave AES hardcoded em `utils/security.ts` permanece. |
| A7  | ⚠️ PARCIAL | SecureStore usado, MAS fallback `AsyncStorage.setItem(LEGACY_TOKEN_KEY, token)` em `authStore.ts:40` salva o JWT em plaintext quando SecureStore não está disponível (web/Expo Go). Defeat parcial. Ver R3. |
| A8  | ⚠️ PARCIAL | `verifyClient` no WebSocket aceita conexão SEM token (sets `_wsAnonymous=true`) e cai no fluxo legado de auth-via-mensagem. Significa que A8 é só "best-effort" — handshake sem JWT ainda é aceito. Ver R4 + WS1. |
| M1  | ⚠️ PARCIAL | `sendError` foi adotado APENAS em `auth.js`, `saloes.js`, `backup.js`, `appProfissionalAuth.js`. Restantes (agendamentos, vendas, produtos, clientes, profissionais, fechamentos, despesas, caixa, metas, atendimentos, comissoes, servicos, sync, appAuth) ainda fazem `res.status(500).json({ error: error.message })` — 60+ ocorrências leakam mensagem original do Postgres em prod. Ver R5. |
| M2  | ✅ OK | URL sanitizada. |
| M3  | ✅ OK | Validação cross-tenant em `produtos-utilizados`. |
| M4  | ✅ OK | Login profissional com salaoId. |
| M5  | ✅ OK | Rota legacy retorna 410. |
| M6  | ✅ OK | `/saloes/publico` com termo obrigatório, rate-limit, campos limitados. |
| M7  | ✅ OK | `type === 'cliente'` exigido. |
| M8  | ✅ OK | JWT default 24h. |
| M9  | ✅ MITIGADO | Content-Type guard funciona. |
| M10 | ✅ OK | `rateLimitKey` combina IP + token-fp. |
| B1-B10 | ✅ OK (não verificadas individualmente — fora de escopo da pass 2) | |

---

## Novos issues encontrados

### 🔴 CRÍTICOS

#### [P2-C1] WebSocket — cliente sobrescreve `salaoId` em CHAT_MESSAGE (cross-tenant injection)
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/websocketService.js:191-200`
- **Descrição:** `handleChatMessage` desestrutura `salaoId` do payload do cliente e usa em `INSERT INTO chat_mensagens (salao_id, ...) VALUES ($1, ...)` com `[salaoId || sender.salaoId, ...]`. O cliente pode informar qualquer `salaoId` arbitrário e gravar uma mensagem de chat em outro tenant. Mesmo `remetenteId`/`remetenteTipo` vêm do payload sem comparação com `sender.userId`/`sender.type` — qualquer cliente autenticado pode forjar mensagens em nome de outro usuário em outro salão.
- **Exploração:** Conectar WebSocket como cliente válido do salão A. Enviar `{ type:'CHAT_MESSAGE', salaoId: <id_de_B>, remetenteId: 1, remetenteTipo: 'admin', destinatarioId: <vitima>, mensagem: 'phishing' }`. Mensagem é entregue aos clientes do salão B em tempo real e persistida.
- **Fix:** Forçar `salaoId = sender.salaoId`, validar `remetenteId === sender.userId` e `remetenteTipo === (sender.type ?? 'admin')`. Validar `destinatarioId` contra o salão do sender (`SELECT 1 FROM <tabela> WHERE id = $1 AND salao_id = $2`).

#### [P2-C2] `loja.js` — pedido usa preço de produto sem filtrar `salao_id` (cross-tenant pricing + injection)
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/loja.js:42`
- **Descrição:** `SELECT preco_venda FROM produtos WHERE id = $1` — sem `salao_id`. Cliente envia pedido com `salonId` = X e `itens` referenciando IDs de produtos do salão Y. O preço lido é o de Y, o pedido é gravado em X (vendor cross-tenant pricing). Pior: o `Venda.create` que cria a venda usa esses `itemId` sem validar tenant → linha venda_itens fica com `produto_id` de outro salão.
- **Exploração:** Cliente honesto descobre que produto popular do salão B custa R$ 50; produto correspondente no salão A custa R$ 200. Atacante (cliente do A) cria pedido com `salonId=A`, `itens=[{produtoId:<B>, quantidade:1}]` — paga R$ 50 e recebe (na lógica do salão A) um produto de R$ 200.
- **Fix:** `SELECT preco_venda FROM produtos WHERE id = $1 AND salao_id = $2 AND ativo = true`. Retornar 400 se não encontrado.

#### [P2-C3] `loja.js` — endpoint público `/saloes/:salonId/produtos` sem auth nem rate-limit
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/loja.js:27-32`
- **Descrição:** Lista TODOS os produtos ativos de qualquer salão a qualquer pessoa (sem JWT). Concorrentes podem enumerar catálogos, preços, estoque (`Produto.getAll` retorna `quantidade_estoque`, `preco_custo`, etc).
- **Exploração:** `for id in 1..10000: GET /api/app/loja/saloes/$id/produtos` — dump completo de pricing intelligence + estoque de todos os clientes da plataforma.
- **Fix:** Exigir auth de cliente (`appAuthMiddleware`) ou pelo menos limitar campos públicos (id, nome, descricao, preco_venda, foto_url) e adicionar rate-limit.

#### [P2-C4] `profissionais.js` — qualquer usuário logado pode resetar senha de profissional e criar admin "shadow"
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/profissionais.js:50-104`
- **Descrição:** As rotas `POST /api/profissionais` e `PUT /api/profissionais/:id` aceitam `senha_app` e geram `senha_hash`, sem `requireAdmin`. Apenas `authMiddleware` (qualquer logado). Um usuário com `tipo='recepcao'` (ou qualquer não-admin) pode resetar a senha de qualquer profissional do salão, fazer login pelo `appProfissionalAuth/login` e usar a sessão de profissional. Combinado com o fato de `requireAdmin` checar apenas `tipo==='admin'` (não há checagem em outras rotas), permite escalada lateral.
- **Exploração:** Atacante com acesso limitado (recepcionista) cria/edita profissional setando `senha_app=Xyz12345`, faz login mobile, obtém JWT profissional e acessa /api/app/profissional/* (ponto, comissões, agenda).
- **Fix:** Adicionar `requireAdmin` em `POST /profissionais`, `PUT /:id`, `DELETE /:id` e em qualquer rota que mude `senha_*` ou status.

### 🟠 ALTOS

#### [P2-A1] `pedidos.js` — `GET /api/app/pedidos/saloes` lista TODOS os salões sem filtro
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/pedidos.js:30-33`
- **Descrição:** Chama `Salao.getAll(req.query)` sem auth e sem `/publico` constraint. Faz bypass da proteção [M6] que foi aplicada em `/api/saloes/publico`. Retorna lista completa de salões (potencialmente com `email`, `telefone`, `cnpj` dependendo do `Salao.getAll`).
- **Fix:** Aplicar mesmo padrão de `/api/saloes/publico` ou deprecar a rota.

#### [P2-A2] `pedidos.js` — endpoints públicos sem auth + sem rate-limit
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/pedidos.js:35-59` (`/saloes/:salonId/servicos`, `/saloes/:salonId/profissionais`)
- **Descrição:** Qualquer um enumera serviços e profissionais de qualquer salão. `verificarDisponibilidade` chamado para cada profissional × cada combinação data/horário pode ser usado como DoS (10 profissionais × N requests).
- **Fix:** Auth obrigatória + rate-limit dedicado.

#### [P2-A3] Race condition em `POST /api/caixa/abrir`
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/caixa.js:58-69`
- **Descrição:** Padrão check-then-insert sem unique constraint ou transação. Dois requests simultâneos passam o `SELECT id FROM caixa WHERE ... AND fechado_em IS NULL` antes de qualquer um inserir → ambos inserem → dois caixas abertos no mesmo dia, quebrando fechamento financeiro. Idem para registros de `entrada`/`saida` de ponto consecutivos.
- **Exploração:** Spray 5 requests simultâneos no `/abrir` — 2-3 caixas abertos, total_vendas é contado em todos.
- **Fix:** Constraint `UNIQUE (salao_id, DATE(aberto_em)) WHERE fechado_em IS NULL` + tratar 23505. Ou `INSERT ... WHERE NOT EXISTS (...)` atomicamente, ou advisory lock.

#### [P2-A4] Race condition em `produtos-utilizados` — estoque pode ir abaixo de "real"
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/appProfissional.js:148-152` e similar em `loja.js`/vendas
- **Descrição:** `UPDATE produtos SET quantidade_estoque = GREATEST(0, quantidade_estoque - $1)` não verifica disponibilidade ANTES do UPDATE. Em paralelo, é possível "vender" mais do que existe em estoque (cada call decrementa). O `GREATEST(0, ...)` esconde overdraft. Não há transação envolvendo INSERT + UPDATE.
- **Fix:** Transação com `SELECT quantidade_estoque ... FOR UPDATE` + erro se < qtd; ou usar `UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1 WHERE id = $2 AND quantidade_estoque >= $1 RETURNING ...` para falha atômica.

#### [P2-A5] Blacklist JWT não cobre cliente/profissional (logout não funciona)
- **Arquivo:** `SOFT-HAIR-SERVER/src/middleware/appAuth.js:17-39`, `clienteAuth.js:13-20`, `profissionalAuth.js:13-21`
- **Descrição:** Apenas `authMiddleware` (admin) chama `AuthService.isTokenRevoked`. Os middlewares de cliente/profissional aceitam JWT até a expiração natural (24h) mesmo após logout. Tokens vazados continuam válidos.
- **Exploração:** Cliente faz logout no app → token continua aceito por 24h se atacante o capturou.
- **Fix:** Aplicar `isTokenRevoked` em todos os 3 middlewares (cliente/profissional/admin).

#### [P2-A6] `sync.js` — INSERT/UPDATE cross-tenant via FKs
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/sync.js:147-186`
- **Descrição:** `sanitizeData` filtra colunas mas não valida que FKs (`cliente_id`, `profissional_id`, `servico_id`, `venda_id`) pertencem ao `salao_id` atual. Cliente pode pushar uma comissão com `profissional_id` de outro salão; FK do Postgres aceita (a tabela `profissionais` global existe). Mesmo problema do [M3] mas em endpoint diferente.
- **Fix:** Para cada FK conhecida em cada tabela, validar via SELECT prévio que o referenced row tem `salao_id = req.salaoId`.

#### [P2-A7] AgendamentoService.criar — sem validação cross-tenant das FKs
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/AgendamentoService.js:97-117`
- **Descrição:** Recebe `cliente_id`, `profissional_id`, `servico_id` e insere com `salao_id`. Não valida que esses IDs pertencem a `salaoId`. O frontend pode mandar IDs cruzados (caso comprometido). [A4] adicionou validação no fluxo IA, mas o fluxo normal `POST /api/agendamentos` continua vulnerável (apenas `body('cliente_id').isInt()`).
- **Fix:** Validar FKs antes do INSERT.

### 🟡 MÉDIOS

#### [P2-M1] Information leakage massivo — 60+ endpoints ainda retornam `error.message`
- **Arquivos:** `src/routes/agendamentos.js`, `atendimentos.js`, `vendas.js`, `produtos.js`, `clientes.js`, `profissionais.js`, `servicos.js`, `fechamentos.js`, `despesas.js`, `caixa.js`, `metas.js`, `comissoes.js`, `historico.js`, `sync.js`, `appAuth.js`, `appProfissional.js:48`, `app/cliente.js` (todos `catch (e) { res.status(500).json({ error: e.message }) }`)
- **Descrição:** Apesar de [M1] ter introduzido `sendError`/`sendErr`, apenas 4-5 rotas foram migradas. O resto continua vazando mensagens de Postgres (`duplicate key value violates unique constraint "ux_xyz"`, `column "abc" does not exist`, etc) em produção.
- **Fix:** Migrar todas as rotas para `sendError`, ou remover `error.message` deixando o error handler global tratar.

#### [P2-M2] WebSocket aceita conexão anônima e cai em auth-via-message
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/websocketService.js:26-31`
- **Descrição:** Comentário explícito: "Não rejeita imediatamente — permite o fluxo de auth via mensagem". Logo o "fix" do A8 é cosmético: handshake sem token ainda é aceito. Timeout de 10s para fechar se não autenticar não impede que um atacante mantenha N conexões anônimas até timer (DoS de slots).
- **Fix:** Modo "strict" via env (`WS_REQUIRE_HANDSHAKE_AUTH=true`) que recusa anônimos. Reduzir o auth-via-message a fluxo legacy com warning.

#### [P2-M3] `caixa.saldo_inicial` aceita valor negativo
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/caixa.js:55,68`
- **Descrição:** `saldo_inicial = 0` default mas não validado. Usuário pode abrir caixa com `saldo_inicial: -999999` para mascarar furto/lavagem contábil.
- **Fix:** `body('saldo_inicial').optional().isFloat({ min: 0 })`.

#### [P2-M4] `loja.js` — `itens.quantidade` não validado (negativo permitido)
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/loja.js:41-48`
- **Descrição:** Loop calcula `subtotal = precoUnitario * item.quantidade` sem checar `quantidade > 0` nem `Number.isInteger`. Cliente envia `quantidade: -5` → `subtotal` negativo → `total` final pode ser zero ou negativo. Venda criada com total inválido.
- **Fix:** Validar `quantidade` como inteiro positivo, abortar com 400.

#### [P2-M5] `appAuth.js` — registro de cliente em tabela `clientes` sem `salao_id`
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/appAuth.js:33-44`
- **Descrição:** `INSERT INTO clientes (nome, email, telefone, senha_hash, app_ativo)` — sem `salao_id`. Se o schema exige NOT NULL, falha (provável). Se NULL é aceito, cria cliente "órfão". Existem dois fluxos de cliente (`/api/app/auth/*` em `appAuth.js` → tabela `clientes`, e `/api/app/legacy/auth/*` em `app/auth.js` → tabela `clientes_app` via model `ClienteApp`). Duplicação confusa. O `/me` em `appAuth.js:99-100` lista qualquer cliente (sem filtrar salão), violando multi-tenancy.
- **Fix:** Decidir qual é o fluxo canônico, depreciar o outro. Se `appAuth.js` é o canônico, garantir `salao_id`. Se `app/auth.js` é o canônico, remover `appAuth.js`.

#### [P2-M6] `pedidos.js` — POST aceita `salonId` arbitrário no body
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/pedidos.js:61-81`
- **Descrição:** Cliente envia `salonId` no body. Não há validação que esse cliente tem vínculo prévio com `salonId`. Combinado com auth-via-email-collision (já mitigada em [C2] mas só no `/api/app/cliente/*`, não aqui), permite criar pedido em qualquer salão.
- **Fix:** Aplicar `requireClienteVinculado` (já criado em `app/cliente.js` mas não usado).

#### [P2-M7] `agendamentos.js` — push lookup sem filtro de tenant
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/agendamentos.js:97-99, 138-140`
- **Descrição:** `SELECT push_token FROM clientes WHERE id = $1 AND push_token IS NOT NULL LIMIT 1` — sem `salao_id`. Após criar agendamento (que está scoped por salaoId), faz lookup global do cliente. Improvável vetor real, mas é defesa-em-profundidade quebrada.
- **Fix:** Adicionar `AND salao_id = $2`.

#### [P2-M8] Mobile: token JWT salvo em AsyncStorage como fallback
- **Arquivo:** `softhair-mobile/store/authStore.ts:39-40,52-54`
- **Descrição:** "Fallback (web/Expo Go onde SecureStore não está disponível): `AsyncStorage.setItem(LEGACY_TOKEN_KEY, token)`". No web build (Expo Web), `expo-secure-store` retorna no-op, então o caminho de fallback PERSISTE o token em `localStorage` browser (acessível por XSS). O comentário marca como "legacy" mas a escrita acontece sempre em paralelo.
- **Exploração:** Build do app em web → token cai em localStorage e fica acessível a XSS.
- **Fix:** No web, usar HttpOnly cookie via backend; no Expo Go, aceitar o degrado mas avisar (`__DEV__` only).

#### [P2-M9] Mobile: dependências com 5 vulns moderate (expo legacy)
- **Arquivo:** `softhair-mobile/package.json`
- **Descrição:** `npm audit` reporta 5 moderate (expo 49 legacy, postcss, @expo/cli, metro). Fix exige major upgrade do Expo.
- **Fix:** Plan migrar para Expo SDK atual (51+).

#### [P2-M10] Frontend: 3 moderate (esbuild/vite dev-only)
- **Arquivo:** `SoftHair/frontend/package.json`
- **Descrição:** esbuild ≤0.24.2 + vite. Dev-only (não afeta build de produção). Fix via `npm i -D vite@latest` (semver-major).

### 🟢 BAIXOS

#### [P2-B1] `requireClienteVinculado` declarado mas nunca usado
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/cliente.js:40-53`
- **Descrição:** Função middleware foi escrita mas nenhuma rota faz `router.get('/x', requireClienteVinculado, ...)`. Atualmente cada handler chama `resolverCliente` inline e retorna `{data:[]}` em vez de 403. Não é exploração ativa, mas indica intenção de proteção que nunca foi materializada — bom para defense-in-depth.

#### [P2-B2] `profissionalAuthMiddleware` legacy (sem blacklist) ainda exportado de 2 lugares
- **Arquivo:** `middleware/profissionalAuth.js` E `middleware/appAuth.js` (função `profissionalAppMiddleware`)
- **Descrição:** Duas implementações quase idênticas. Uma é usada em `appProfissional.js`, outra está órfã. Risco baixo mas confunde manutenção.

#### [P2-B3] Endpoint `/api/app/legacy/auth/profissional/login` ainda registrado (apenas retorna 410)
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/auth.js:67-73`
- **Descrição:** Path morto. Não é vulnerabilidade, mas pode ser removido para reduzir superfície.

#### [P2-B4] `Salao.getAll` chamado de rota pública sem documentação dos campos expostos
- **Arquivo:** `pedidos.js:31`
- **Descrição:** Já listado como [P2-A1]. Reforço: revisar campos retornados por `Salao.getAll` (email, cnpj, etc).

#### [P2-B5] `profissionais.js`/`clientes.js` — pagamento de listas sem `LIMIT` real cap
- **Arquivo:** `clientes.js:12` `limit = 500` default, sem cap superior. ClienteService cap em 100 internamente (linha 7). `produtos.js:24` cap em 2000. Inconsistente.
- **Fix:** Padronizar `Math.min(parseInt(limit) || 100, 200)` em todas as listas.

#### [P2-B6] Mensagem do lockout vaza horário exato de desbloqueio
- **Arquivo:** `server.js:190-192`
- **Descrição:** Retorna `Tente novamente após ${unlockAt.toISOString()}` — útil pra atacante calibrar retry. Melhor: "Tente novamente em alguns minutos".

#### [P2-B7] `caixa.js` — `req.userId` usado mas não é setado pelo `authMiddleware`
- **Arquivo:** `caixa.js:68` (`aberto_por: req.userId`)
- **Descrição:** `authMiddleware` seta `req.user` (com `userId` dentro), não `req.userId`. INSERT está gravando `aberto_por = undefined` (NULL). Não é vuln, é bug de auditoria — registros de caixa sem rastreabilidade do autor.

#### [P2-B8] Login attempt tracker registra apenas /login, ignora /register
- **Arquivo:** `server.js:227`
- **Descrição:** Regex `/\/login\b/` exclui o endpoint /register que também pode ser brute-forced (timing-based email enumeration).
- **Fix:** Estender o regex.

#### [P2-B9] `recordLoginAttempt` registra mesmo quando email está vazio (string vazia)
- **Arquivo:** `server.js:207`
- **Descrição:** `if (!email) return;` — só skipa quando undefined/null. Caso bug do client mande email="", grava em DB.

#### [P2-B10] `hsts.preload = true` sem submeter o domínio para hstspreload.org
- **Arquivo:** `server.js:41` (já documentado em [B4])
- **Descrição:** Sem impacto, mas o header anuncia "preload" sem estar de fato preloaded.

---

## Resumo

- **Regressões dos fixes pass 1:** 5 parciais/efeito limitado (C2, A2, A7, A8, M1)
- **Novos críticos:** 4 (WS cross-tenant chat, loja preço cross-tenant, /loja/saloes/:id/produtos sem auth, profissionais sem requireAdmin)
- **Novos altos:** 7 (saloes leak, race conditions caixa/estoque, blacklist parcial, FK cross-tenant em sync e agendamentos)
- **Novos médios:** 10 (info leak massivo, WS anonymous, validações negativas, mobile fallback inseguro, etc.)
- **Novos baixos:** 10 (dead code, inconsistências, melhorias defensivas)

### Prioridades recomendadas
1. **Imediato** (CRÍTICOS): C1-C4 acima. P2-C1 (WS chat injection) e P2-C2 (loja cross-tenant price) são triviais de explorar com qualquer cliente válido.
2. **Esta sprint** (ALTOS): A1-A7. Especialmente A3 (race caixa) e A5 (blacklist cliente/profissional) por afetarem multi-tenant accounting e revogação.
3. **Próxima sprint** (MÉDIOS): completar migração `sendError`, fechar fluxos duplicados de cliente auth.
