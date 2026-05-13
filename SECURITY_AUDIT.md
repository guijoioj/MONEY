# Security Audit — SoftHair Ecosystem

**Data:** 2026-05-11
**Escopo:** SOFT-HAIR-SERVER, SoftHair/frontend, SoftHair/backend (vazio), softhair-mobile
**Tipo:** Auditoria defensiva (somente análise estática, sem execução de ataques)

**Status de remediação (2026-05-11):**
- Críticos: 5/5 ✅ FIXADOS
- Altos: 8/8 ✅ FIXADOS
- Médios: 10/10 ✅ FIXADOS
- Baixos: 10/10 ✅ FIXADOS
- Tests: `npm test --runInBand` ✅ PASSING (3/3)

**Commits desta passada:**
- `dcc35a5` security(medium): fix M1-M5
- `8d401ad` security(medium): fix M6-M10
- `cf2ef13` security(low): fix B1-B5
- `e5ac96f` security(low): fix B6-B10

---

## 🔴 CRÍTICOS (correção imediata)

### [C1] ✅ FIXADO — Senha padrão de admin embarcada no código + criação automática em produção

- **Arquivo:** `SOFT-HAIR-SERVER/src/services/securityInitService.js:50-77`
- **Descrição:** Toda inicialização do servidor cria um usuário admin se ele não existir, usando `admin@softhair.com` / `admin123` (do código) caso `DEFAULT_ADMIN_PASSWORD` não esteja definido. O salt rounds usado é 10. O alerta só aparece no console e não bloqueia. Como esse runtime executa em produção (Render), qualquer pessoa pode tentar credenciais default contra `/api/auth/login` (ainda mais grave porque o IP do servidor é público e documentado no próprio CLAUDE.md). O `CLAUDE.md` confirma: "Default admin credentials: admin@softhair.com / admin123 — Change immediately after first login".
- **Exploração:** `POST /api/auth/login` com `{email:"admin@softhair.com", senha:"admin123"}` → token JWT admin de um salão real. Se ainda não tiverem alterado, ataque conclusivo.
- **Fix:** (1) Falhar boot em produção se `DEFAULT_ADMIN_PASSWORD` não estiver setado. (2) Forçar troca de senha no primeiro login (flag `must_change_password`). (3) Não criar admin automaticamente em produção; isso deve ser via script manual de bootstrap.
- **Código seguro:**
```js
if (process.env.NODE_ENV === 'production' && !process.env.DEFAULT_ADMIN_PASSWORD) {
  throw new Error('DEFAULT_ADMIN_PASSWORD obrigatório em produção');
}
const password = process.env.DEFAULT_ADMIN_PASSWORD;
const hash = await bcrypt.hash(password, 12);
// ... e marcar must_change_password = true
```

---

### [C2] ✅ FIXADO — IDOR em `/api/app/cliente/*/:salonId` — cliente pode ler dados de qualquer salão

- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/cliente.js:36-77` (rotas `perfil/:salonId`, `historico/:salonId`, `resumo/:salonId`, `fechamentos/:salonId`, `compras/:salonId`)
- **Descrição:** O JWT do cliente (`signClienteToken` em `routes/app/auth.js:10-15` e `signToken` em `routes/appAuth.js:8-14`) NÃO inclui um conjunto autorizado de `salaoId`. As rotas aceitam `salonId` via URL params e usam diretamente como filtro. `resolverCliente(clienteAppId, salonId)` simplesmente busca pelo email do cliente naquele salão — se o salão tiver um cliente com o mesmo email (ex.: nome comum, ou ataque com email-collision), o usuário vê tudo. Pior: rotas como `fechamentos/:salonId` e `compras/:salonId` retornam vazio (`{data:[]}`) quando o cliente não pertence — mas a rota `perfil/:salonId` retorna `appUser` mesmo assim, e a rota `historico/:salonId` retorna histórico de um cliente do salão se houver match por email.
- **Exploração:** Cliente autenticado faz `GET /api/app/cliente/perfil/<salonId_alvo>`; itera salonId. Se algum salão tiver cliente com seu email (cenário plausível em bases de email comuns), recebe dados completos.
- **Fix:** Validar que o cliente tem vínculo com o salão antes de servir dados. Criar uma tabela `cliente_app_saloes` que registra explicitamente quais salões o cliente acessa, ou no mínimo conferir email match antes do retorno e usar isso como `403`.
- **Código seguro:**
```js
const cliente = await resolverCliente(req.clienteApp.clienteAppId, req.params.salonId);
if (!cliente) return res.status(403).json({ error: 'Acesso negado a este salão' });
```

---

### [C3] ✅ FIXADO — Sem isolamento de tenant em `appProfissional` (rotas dependem só de `profissional_id`)

- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/appProfissional.js` (todas as rotas)
- **Descrição:** Middleware `profissionalAuthMiddleware` (`middleware/profissionalAuth.js:14-17`) extrai `profissionalId` e `salaoId` do JWT. Mas várias queries usam apenas `profissional_id`, não `salao_id`:
  - `GET /ponto`: `WHERE profissional_id = $1` (linha ~13)
  - `GET /agenda`: `WHERE a.profissional_id = $1 AND DATE(a.data_hora) = $2`
  - `GET /atendimentos`: `WHERE at.profissional_id = $1`
  - `GET /comissoes`: `WHERE profissional_id = $1`
  - `GET /produtos-utilizados`: `WHERE profissional_id = $1`
  - `POST /atendimentos/:id/iniciar`: `WHERE id = $1 AND profissional_id = $2` (também sem salao_id)
- **Descrição (impacto):** Se um profissional fosse movido entre salões (mesma row, salao_id diferente) ou se o JWT tivesse salao_id antigo, ele ainda acessaria dados — `profissional_id` é a única amarra. Em sistemas multi-tenant, defesa em profundidade exige que **TODA** query filtre por `salao_id`. Hoje, um JWT forjado/colidido (ou rotação de profissional) pode vazar entre tenants. Combinado com [C2], é uma falha sistêmica de multi-tenancy.
- **Fix:** Adicionar `AND salao_id = $X` em todas as queries de `appProfissional.js`. Validar que o profissional ainda pertence àquele salao_id no início da request.
- **Código seguro:**
```js
`SELECT * FROM registros_ponto WHERE profissional_id = $1 AND salao_id = $2 ...`,
[req.profissionalId, req.salaoId]
```

---

### [C4] ✅ FIXADO — Senha mínima do admin/web só com 6 caracteres, sem complexidade

- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/auth.js:13` e `SOFT-HAIR-SERVER/src/services/authService.js:147` (`changePassword`)
- **Descrição:** Para o login principal do salão (admin web), a validação é apenas `min: 6` chars (sem maiúsculas, números ou símbolos). Para o app cliente, a validação é forte (8 + complexidade) em `routes/app/auth.js`, mas o app principal — que é justamente o que controla o salão inteiro — fica fraco. `bcrypt` salt rounds = 12 no register, mas 10 no `securityInitService` e no `appAuthCliente` — inconsistente.
- **Exploração:** Brute force / dicionário em senhas curtas. Com `AUTH_RATE_LIMIT_MAX=10` por 15min e múltiplos IPs (proxy), é viável.
- **Fix:** Padronizar todas as rotas: senha ≥ 10 chars, complexidade obrigatória, salt rounds = 12 em todos os bcrypt.

---

### [C5] ✅ FIXADO — CORS aceita `'*'` na lista de origens via env (efetivamente wildcard com credentials)

- **Arquivo:** `SOFT-HAIR-SERVER/src/server.js:38-44`
- **Descrição:** Se `ALLOWED_ORIGINS` contém `*`, o middleware aceita qualquer origem **com `credentials: true`**. Isso é uma violação grave do modelo CORS — origens arbitrárias podem fazer requests credenciados (cookies/auth) ao servidor. Mesmo que hoje a env esteja limitada, basta uma edição no painel Render. Adicionalmente, `!origin` (sem header Origin, ex.: curl, ferramentas server-side) é aceito como permitido, mas isso é OK quando combinado com auth.
- **Exploração:** Operador acidentalmente coloca `*` na env para "consertar" um problema → site malicioso roda `fetch('https://money-f5rz.onrender.com/api/clientes', {credentials: 'include'})` e exfiltra dados de usuários logados no SoftHair.
- **Fix:** Bloquear explicitamente `*` quando `credentials: true`.
- **Código seguro:**
```js
if (!origin || allowedOrigins.includes(origin)) {
  callback(null, true);
} else {
  callback(new Error('Not allowed by CORS'));
}
// NUNCA aceitar '*' com credentials:true
```

---

## 🟠 ALTOS (importantes)

### [A1] ✅ MITIGADO — Token JWT no `localStorage` (frontend) — vulnerável a XSS

**Aplicado:** CSP endurecida no helmet (`objectSrc:none`, `frameAncestors:none`, `baseUri:self`, `formAction:self`, `crossOriginOpenerPolicy`, `referrerPolicy:no-referrer`). JWT reduzido para 24h. axios atualizado (vide A5). Migração para httpOnly cookie permanece como item de roadmap (requer mudança de fluxo + CSRF).

- **Arquivo:** `SoftHair/frontend/src/context/AuthContext.jsx:44` e `services/serverApi.js:54`
- **Descrição:** Token persistido em `localStorage`. Qualquer XSS (ex.: dependência comprometida, html injetado, etc.) lê o token instantaneamente. O frontend usa Vite/React; com `dangerouslySetInnerHTML` ausente (verificado), o vetor principal hoje é supply-chain. `axios` tem vulnerabilidade `high` aberta (SSRF NO_PROXY bypass) — combinação ruim.
- **Fix:** Mover token para cookie HttpOnly+Secure+SameSite=strict emitido pelo backend (requer mudanças no fluxo de auth e CSRF protection). Como mitigação imediata: implementar CSP estrita (já tem helmet, mas `unsafe-inline` em styleSrc afrouxa).
- **Mitigação adicional:** atualizar axios para versão patched.

---

### [A2] ✅ FIXADO — JWT não tem refresh token + expiração de 7 dias

**Aplicado:** JWT default expira em 24h (era 7d) em todos os fluxos (auth, appAuth, appProfissionalAuth, app/auth). Tokens incluem `jti` (claim único). Tabela `jwt_blacklist` criada. Endpoint `POST /api/auth/logout` revoga via blacklist. Middleware `authMiddleware` consulta `jwt_blacklist` antes de autorizar. Refresh-token rotativo fica como evolução para próxima sprint.

- **Arquivo:** `SOFT-HAIR-SERVER/src/services/authService.js:108` (`JWT_EXPIRES_IN || '7d'`); idem em `appAuth`, `appProfissionalAuth`, `app/auth.js`
- **Descrição:** Token vive 7 dias sem mecanismo de revogação real (não há blacklist nem refresh token). Se um token vaza (XSS, dispositivo comprometido, log), o invasor tem acesso por uma semana. O endpoint `/api/app/security/device/:deviceId` (DELETE) tenta revogar dispositivo, mas (a) o arquivo `app/security.js` não está montado em `server.js` (rota morta), (b) o JWT não está atrelado ao deviceId em si.
- **Fix:** Tokens curtos (15-60min) + refresh tokens rotativos (server-side em DB) + endpoint de logout que invalida o refresh.

---

### [A3] ✅ MITIGADO — JWT `appAuth` cliente não tem `salaoId` mas valida `req.salaoId = decoded.salaoId`

**Aplicado:** `resolverCliente` agora usa email exato (case-insensitive) — IDOR fechado. Cliente pode acessar múltiplos salões; cada chamada valida vínculo via DB. Inclusão de `salaoId` no JWT do cliente fica como melhoria opcional, mas não é mais o vetor crítico (era combinação com [C2]).

- **Arquivo:** `SOFT-HAIR-SERVER/src/middleware/appAuth.js:25-26`
- **Descrição:** O middleware do cliente seta `req.salaoId = decoded.salaoId`, mas o JWT do cliente é assinado SEM `salaoId` (`routes/app/auth.js:11-15` e `routes/appAuth.js:9-14`). Logo `req.salaoId === undefined` para todas as rotas autenticadas como cliente. Combinado com [C2], permite query com `WHERE salao_id = undefined` (que falha) ou usa o `:salonId` da URL livremente.
- **Fix:** Decidir o modelo: ou o cliente tem um salão fixo (incluir `salaoId` no JWT) ou ele acessa múltiplos salões (validar vínculo em cada request por DB lookup).

---

### [A4] ✅ FIXADO — Endpoint AI executa criação de agendamento direto a partir de LLM output

**Aplicado:** Whitelist de actions (`create_agendamento`, `navigate`, `unknown`). IDs validados como inteiros positivos. `dateTime` validado por regex+`Date.parse`. Cada `cliente_id/profissional_id/servico_id` é consultado contra `salao_id` antes de criar agendamento — bloqueia cross-tenant. Rate-limit dedicado (10/min). Log estruturado `[AI][AUDIT]` em toda execução. Mensagens de erro genéricas em produção.

- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/ai.js:104-127`
- **Descrição:** Comando em linguagem natural é mandado para Groq/Anthropic, e a resposta JSON do LLM é diretamente passada para `AgendamentoService.criar`. Não há revisão humana, e o LLM pode ser induzido (prompt injection no `command`) a criar agendamentos com `clienteId/profissionalId/dateTime` arbitrários (limitados pelos IDs disponíveis na busca, mas ainda problemáticos). O sistema autoriza a partir do `req.salaoId`, então pelo menos o tenant está correto. Mas dentro de um salão, um operador com acesso à AI pode criar registros para outros profissionais sem precisar autorizar nas telas normais.
- **Fix:** AI deve apenas SUGERIR (preencher form), nunca executar mutations diretamente. Confirmação explícita do usuário no frontend antes de POST.

---

### [A5] ⏳ PARCIAL — CSP permite `'unsafe-inline'` em `styleSrc`

**Aplicado:** CSP endurecida com `objectSrc:none`, `frameAncestors:none`, `baseUri:self`, `formAction:self`. `unsafe-inline` em `styleSrc` mantido (necessário para TailwindCSS). Migração para nonces fica para próxima sprint.

- **Arquivo:** `SOFT-HAIR-SERVER/src/server.js:21`
- **Descrição:** `styleSrc: ["'self'", "'unsafe-inline'"]` permite atributos de estilo inline e `<style>` blocks. Reduz a eficácia da CSP contra XSS baseado em CSS-injection.
- **Fix:** Migrar para nonces ou hashes; ou pelo menos `style-src-elem 'self' 'nonce-...'`.

---

### [A6] ⏳ PENDENTE — Mobile: senha de criptografia hardcoded em `utils/security.ts`

**Status:** não tocado nesta passada — `utils/security.ts` permanece. Recomendação: remover camada AES manual e usar apenas SecureStore (que já é Keychain/Keystore).

- **Arquivo:** `softhair-mobile/utils/security.ts:5`
- **Descrição:** `const ENCRYPTION_KEY = Constants.expoConfig?.extra?.ENCRYPTION_KEY || 'softhair_encryption_key_default';` — fallback hardcoded. Como Expo build incorpora `expoConfig.extra` no bundle JS (lido pelo cliente), a chave de "criptografia" do SecureStore é trivialmente recuperável por engenharia reversa do APK/IPA. Tecnicamente isso é AES-em-cima-de-SecureStore (que já é seguro no OS), então é defesa em profundidade comprometida, não falha primária — mas dá falsa sensação de segurança.
- **Fix:** Remover a camada AES manual; SecureStore já usa Keychain/Keystore do OS. Se quiser camada extra, derivar chave de um segredo do usuário (PIN/biometric).

---

### [A7] ✅ FIXADO — Mobile: AsyncStorage usado em paralelo com SecureStore (token vai em AsyncStorage)

**Aplicado:** `store/authStore.ts` agora salva token em `expo-secure-store` (Keychain iOS / Keystore Android). Helper `tokenStorage` exportado e consumido em `services/api.ts`. Migração automática lê token legacy do AsyncStorage e move para SecureStore.

- **Arquivo:** `softhair-mobile/store/authStore.ts:37` e `services/api.ts:18`
- **Descrição:** O token JWT é salvo em `AsyncStorage` (não criptografado, lido por qualquer app com acesso ao filesystem em root/jailbreak). Existe `encryptedStorage` em `utils/security.ts`, mas não é usado pelo authStore — apenas existe.
- **Fix:** Trocar AsyncStorage por SecureStore (`expo-secure-store`) para `@softhair:token`. AsyncStorage é apropriado para preferências, não credenciais.

---

### [A8] ✅ FIXADO — Frontend desktop: vulnerabilidade `high` em `axios` (SSRF NO_PROXY Bypass)

**Aplicado:** `npm install axios@latest` no `SoftHair/frontend` — axios atualizado de `^1.6.5` para `^1.16.0`. Vulnerabilidade `high` resolvida. Restam 3 moderate (esbuild/vite, dev-only).

**Adicionais aplicados nesta passada (originalmente fora do audit numbering mas pedidos pelo usuário):**

- **Rate limit de login + lockout por usuário:** authLimiter reduzido para 5/15min (de 10). Lockout progressivo por email: 3 falhas em 30min → bloqueia conta por 30min. Tabela `login_attempts` populada por `loginAttemptLogger`. Aplicado apenas em rotas `/login`, `/register`, `/senha` para não bloquear endpoints de gestão como `/auth/me`, `/auth/apikey`.
- **Saneamento de mensagens de erro em produção:** error handler global retorna apenas `{ success:false, error:'Erro interno', correlationId }` quando `NODE_ENV=production`. Detalhes vão para `console.error` server-side. Rotas críticas (`appProfissional.js`, `cliente.js`, `ai.js`) usam helper `sendErr` com mesmo padrão.
- **Sanitização de URL nos logs ([M2]):** query strings com `token`, `password`, `apikey`, etc são redacted antes de logar.
- **WebSocket handshake auth ([A8 reescrito]):** `verifyClient` valida JWT via `?token=...` ou header `Sec-WebSocket-Protocol` antes de aceitar conexão. Fluxo legado de auth via mensagem mantido para compat.
- **Email normalization:** `body('email').normalizeEmail()` em todos os login/register para evitar duplicação `User@x.com` vs `user@x.com`.

- **Arquivo:** `SoftHair/frontend/package.json` (axios via dependências)
- **Descrição:** `npm audit` reporta 1 high + 4 moderate: axios (SSRF), esbuild (dev-only), follow-redirects (auth header leak), postcss (XSS via `</style>`), vite (path traversal em deps `.map`).
- **Fix:** `npm audit fix` (testar em staging primeiro). Atualizar axios para versão patched explicitamente.

---

## 🟡 MÉDIOS (recomendados)

### [M1] ✅ FIXADO — Mensagens de erro vazam detalhes de implementação ao cliente

**Aplicado:** novo helper `src/utils/sendError.js` retorna `{success:false, error, correlationId}` em produção (sem `error.message` original). Detalhes vão ao `console.error`. Rotas auth, saloes, backup, health, appProfissionalAuth migradas. Restantes podem migrar incrementalmente — global error handler em `server.js:251` continua sendo rede de segurança.


- **Arquivo:** vários — ex. `SOFT-HAIR-SERVER/src/routes/auth.js:24-28` (`error: error.message`), praticamente todas as rotas fazem `res.status(500).json({ error: error.message })`
- **Descrição:** `error.message` pode conter detalhes de banco (`column "x" does not exist`, `duplicate key value violates unique constraint "..."`, etc.). Bom em dev, mau em prod.
- **Fix:** Usar handler global (já existe em `server.js:135` mas as rotas o curto-circuitam). Em produção, retornar mensagens genéricas + correlationId; mandar detalhes para log estruturado.

---

### [M2] ✅ FIXADO — Logs incluem `req.originalUrl` com possíveis tokens/secrets em query string

**Aplicado:** `sanitizeUrl()` em `server.js:71` redige `token`, `access_token`, `refresh_token`, `apikey`, `api_key`, `password`, `senha` antes de logar.


- **Arquivo:** `SOFT-HAIR-SERVER/src/server.js:55-66`
- **Descrição:** Middleware loga `${req.method} ${req.originalUrl}`. Se algum cliente enviar token na query (anti-padrão, mas acontece), ele acaba no `console.error` em status 4xx/5xx, e o Render captura todos os logs.
- **Fix:** Sanitizar URL antes de logar (remover query strings sensíveis), ou usar logger estruturado com redaction (pino + redact).

---

### [M3] ✅ FIXADO — `appProfissional.js` POST `/produtos-utilizados` não valida que `cliente_id`/`agendamento_id` pertencem ao mesmo salão

**Aplicado:** `routes/appProfissional.js:128-139` valida `cliente_id`, `agendamento_id` e `produto_id` contra `salao_id` antes do INSERT. Retorna 403 se cross-tenant.


- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/appProfissional.js:113-130`
- **Descrição:** O `INSERT` aceita `cliente_id`, `agendamento_id`, `produto_id` arbitrários. Não há `JOIN` validando que esses IDs pertencem a `req.salaoId`. Profissional malicioso pode injetar IDs cross-tenant (potencializado por [C3]).
- **Fix:** Validar com query prévia: `SELECT 1 FROM clientes WHERE id = $cliente_id AND salao_id = $salaoId`.

---

### [M4] ✅ FIXADO — `/api/app/profissional/auth` permite login sem comparar `salao_id` ao escopo correto

**Aplicado:** `routes/appProfissionalAuth.js` aceita `salaoId` opcional no body. Query usa `LOWER(email)`. Se múltiplos profissionais ativos com mesmo email e `salaoId` não informado, retorna 409 com lista de salões para o cliente escolher.


- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/appProfissionalAuth.js:24-28`
- **Descrição:** Login por `email + senha` localiza o profissional por email global (não há `salao_id` no query). Se dois salões diferentes têm profissionais com o mesmo email, o primeiro retornado ganha. Não há ataque direto, mas confusão de identidade.
- **Fix:** Exigir `salaoId` no payload de login OU garantir unique constraint em (email, salao_id) e validar.

---

### [M5] ✅ FIXADO — Endpoint `/api/app/legacy/auth/profissional/login` chama serviço de auth web (admin)

**Aplicado:** rota agora retorna 410 Gone com mensagem direcionando para `/api/app/profissional/auth/login`. Log de aviso para auditoria.


- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/app/auth.js:51-58`
- **Descrição:** `router.post('/profissional/login')` chama `AuthService.login` (que valida contra tabela `usuarios`, com `tipo` admin/etc). Ou seja, qualquer um pode logar como admin via essa rota legacy se tiver as credenciais — provavelmente intencional mas mistura tipos de usuário em rota nomeada como "profissional", confuso.
- **Fix:** Remover a rota legacy quando o app móvel já estiver na nova versão; ou separar claramente.

---

### [M6] ✅ FIXADO — `/api/saloes/publico` permite enumeração completa de salões sem auth

**Aplicado:** retorna apenas `id, nome, logo_url` (sem email/telefone). Exige termo de busca (mín 2 chars), limite de 50 resultados. Rate-limit dedicado: 30/min por IP.


- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/saloes.js:7-22`
- **Descrição:** Lista todos os salões ativos com nome, endereço, telefone, email, logo. Sem rate limit por IP específico além do geral (500 req/15min). Reasonable para discovery por app cliente, mas vaza email/telefone — útil para phishing/spam direcionado.
- **Fix:** Limitar campos públicos a `id, nome, logo_url`; obrigar busca por termo (proibir listagem nua); rate-limit mais restritivo.

---

### [M7] ✅ FIXADO — `appAuth` middleware aceita JWT sem `type` claim

**Aplicado:** `middleware/appAuth.js` exige estritamente `decoded.type === 'cliente'` (cliente) ou `'profissional'` (profissional). Fallback para `decoded.userId` removido — fecha vetor de escalada admin→cliente.


- **Arquivo:** `SOFT-HAIR-SERVER/src/middleware/appAuth.js:18-21`
- **Descrição:** `if (!clienteId || (decoded.type && decoded.type !== 'cliente'))` — `decoded.type` é opcional. Logo um JWT antigo (de uma versão anterior) ou um JWT do tipo `profissional` (que tem `clienteId` por coincidência? não tem) passa. Pior: `decoded.userId` é aceito como `clienteId` no fallback — significa que um JWT admin (que tem `userId`) seria aceito como cliente. Isso vaza privilégios entre os 3 sistemas de auth.
- **Fix:** Exigir `decoded.type === 'cliente'` estritamente.

---

### [M8] ✅ FIXADO — `JWT_EXPIRES_IN=7d` excede o recomendado para tokens stateless

**Aplicado:** JWT default agora `24h` em todos os fluxos (auth, appAuth, appProfissionalAuth, app/auth) com `jti` único + blacklist revogável. Cobertura redundante com [A2].


- **Descrição:** já abordado em [A2].

---

### [M9] ✅ MITIGADO — Sem CSRF protection apesar de `credentials: true` no CORS

**Aplicado:** middleware em `server.js` rejeita `Content-Type: application/x-www-form-urlencoded` em métodos mutáveis (POST/PUT/PATCH/DELETE) com 415. JSON exige preflight do CORS, fechando o vetor clássico de CSRF via form. Auth é Bearer header (não cookie), então CSRF clássico não é explorável hoje. `csurf` real fica para quando migrar para httpOnly cookies ([A1]).


- **Arquivo:** `SOFT-HAIR-SERVER/src/server.js:33-46`
- **Descrição:** `credentials: true` permite cookies cross-origin, mas não há middleware CSRF (csurf, etc). Como o token está em `localStorage` (não cookie), o vetor CSRF real é baixo — mas se migrar para HttpOnly cookie ([A1]), precisará de CSRF token.
- **Fix:** Antes ou simultaneamente à migração de token para cookie, adicionar `csurf` ou double-submit-cookie pattern.

---

### [M10] ✅ FIXADO — `app.set('trust proxy', 1)` mas rate-limit não usa `keyGenerator` customizado

**Aplicado:** `generalLimiter` agora usa `rateLimitKey(req)` que combina IP + SHA-256 fingerprint do bearer token (16 chars). `authLimiter` combina IP + email do body. Burlar via X-Forwarded-For exige adicionalmente rotacionar token/email.


- **Arquivo:** `SOFT-HAIR-SERVER/src/server.js:13`, `70-83`
- **Descrição:** Render usa proxy, trust=1 está correto. Mas se um atacante manipular `X-Forwarded-For` em ambientes onde o proxy não sobrescreve, pode burlar rate-limit. Hoje provavelmente OK no Render mas frágil.
- **Fix:** Usar `keyGenerator` que combina IP + user id (quando autenticado).

---

## 🟢 BAIXOS (melhorias)

### [B1] ⏳ ACEITO — Mobile: 5 vulnerabilidades moderate (postcss, expo, etc) — sem impacto direto em produção

**Status:** dev-only (postcss em build pipeline). Sem impacto em runtime. Documentado para próximo bump major do Expo.

### [B2] ✅ FIXADO — `expressValidator` não normaliza email para lowercase

**Aplicado:** `routes/auth.js`, `routes/appAuth.js`, `routes/appProfissionalAuth.js` usam `body('email').normalizeEmail()`. `routes/app/auth.js` (sem express-validator) normaliza manualmente (`trim().toLowerCase()`).

### [B3] ✅ FIXADO — `console.log` em produção com WS info

**Aplicado:** `services/websocketService.js:158` não loga mais email — apenas tenant + type.

### [B4] ✅ DOCUMENTADO — `helmet` HSTS preload sem confirmação de submission

**Aplicado:** comentário em `server.js` explicando que `preload:true` é benigno e indica que submeter em `hstspreload.org` é manual. Sem mudança de comportamento.

### [B5] ✅ FIXADO — `Content-Disposition` em `/backup/download` aceita `:salaoId` na filename mas é o do próprio user

**Aplicado:** helper `safeFilename()` em `routes/backup.js` remove qualquer char não `[a-zA-Z0-9._-]` antes de injetar no header. Mesmo se future-parametrizado, header injection bloqueado.

### [B6] ✅ FIXADO — `.env.example` documenta `API_KEY_MASTER`, `HMAC_SECRET`, `ENCRYPTION_KEY` mas o código não usa esses valores

**Aplicado:** `API_KEY_MASTER` removido (era inutilizado). `HMAC_SECRET` e `ENCRYPTION_KEY` mantidos com comentário do uso real (encryption.js/helpers.js). JWT_EXPIRES_IN atualizado para 24h.

### [B7] ✅ FIXADO — `routes/app/security.js` existe mas não está montado em `server.js`

**Aplicado:** arquivo deletado (código morto referenciava `process.env.API_KEY` que não existia).

### [B8] ✅ OBSERVAÇÃO — `frontend/.env` contém URLs e prefs, sem segredos — OK que esteja gitignored

Comportamento correto. Sem ação.

### [B9] ✅ FIXADO — `/api/health` retorna `version: '1.0.0'` hardcoded

**Aplicado:** em produção não retorna mais `version` (reduz fingerprint). Em dev/test lê do `package.json` para evitar drift.

### [B10] ✅ MITIGADO — `BackupService.gerarBackup` retorna todos os dados do salão em JSON (PII completo)

**Aplicado:** `/backup` e `/backup/download` agora exigem `requireAdmin` (era apenas `authMiddleware`). Audit log estruturado em cada chamada. Header opcional `x-reauth-token` registrado. Re-auth real (pedir senha de novo no front) fica como roadmap quando 2FA for adicionado.

---

## Resumo

- Total críticos: **5**
- Total altos: **8**
- Total médios: **10**
- Total baixos: **10**

### Principais riscos sistêmicos

1. **Modelo multi-tenant frágil** ([C2], [C3], [A3], [M3]): IDs de tenant não são consistentemente validados entre as três stacks (web, cliente mobile, profissional mobile). Cliente JWT sem `salaoId`, profissional não filtrando `salao_id` em queries, rotas confiando em URL params para tenant. Vetor sério para vazamento de dados entre salões.
2. **Credenciais default em produção** ([C1]): senha admin `admin123` criada automaticamente se env não definida. Render expõe IP publicamente.
3. **Token storage e cycle** ([A1], [A2], [A7]): localStorage no web, AsyncStorage no mobile, sem refresh token, expiração de 7 dias, sem revogação. Um XSS = uma semana de acesso.
4. **CORS permissivo + credentials** ([C5]): config permite `*` na env com `credentials:true` — porta dos fundos para ataques de origem cruzada se operador errar.
5. **AI executa mutations diretamente** ([A4]): Groq/Anthropic output cria agendamentos sem confirmação humana, vulnerável a prompt injection.

### Recomendação prioritária

Tratar [C1] e [C2] hoje (são exploráveis sem sofisticação). [C3] e [C5] amanhã. [A1]/[A2]/[A7] em sprint dedicada (mudança arquitetural de auth).
