# Electron Audit Pass 2

Auditoria de verificação dos fixes do Pass 1 + novos ângulos. Branch: `claude/brave-beaver-6c804d`.

Pass 1 entregou 26/30 fixados + 4 aceitos. Este pass 2 confere se os fixes funcionam de verdade, busca race conditions nos novos código, valida o setup wizard, distribuição electron-builder, conflitos de sync, logs sensíveis, IPC, schema drift, recovery, e revisa o que sobrou em frontend legacy.

---

## Verificação dos fixes Pass 1

| Item | Fix esperado | Verificação | Status |
|---|---|---|---|
| E1 JWT_SECRET | secrets.json com 0o600, fallback abort | Arquivo escrito com `mode: 0o600` + `chmodSync`; em prod aborta se falhar | ✅ |
| E2 token cloud AES-256-GCM | IV único por encrypt + tag | `crypto.randomBytes(12)` por chamada, GCM tag, key via HMAC | ✅ (com ressalva — ver P2-N1) |
| E3 HTTPS + rejectUnauthorized | Default true em pg, valida cloudUrl | `sslOpt = { rejectUnauthorized: true }` default; `isValidCloudUrl()` aplicado | ✅ |
| E4 sync sem senha_hash | Allowlist `TABLE_COLUMNS` sem `senha_hash` | Confirmado em syncService.js:54-58 | ✅ |
| E5 contrato push | `[{table, operation, data}]` | Format ok em collectLocalChanges | ✅ (com ressalva — ver P2-N3 schema drift no SOFT-HAIR-SERVER allowlist) |
| E6 pull com salao_id | Validado em applyRemoteChanges | linha 399-409: rejeita se salao_id != local | ✅ |
| E7 CORS allowlist | origins fixos | linha 47-52: lista explícita | ✅ |
| E8 sem admin default | bootstrap-admin via UI, bcrypt 10 | auth.js + initDb.js linhas 196-223 | ✅ |
| E9 disconnect | rota POST /sync/disconnect | sync.js linha 27-30; syncService.disconnect() | ✅ |
| E10 graceful shutdown | shutdown handler com close DB | server.js linha 146-163 | ✅ |
| E11 single instance | `requestSingleInstanceLock` | main.js linha 35-45 | ✅ |
| E12 openExternal whitelist | apenas https/http/mailto | preload.js ALLOWED_PROTOCOLS | ✅ |
| E13 CSP | meta tag + helmet CSP | index.html linha 7 + server.js linha 30 | ✅ |
| E15 setWindowOpenHandler + will-navigate | navegação restrita | main.js 220-235, 244-258, 263-268 | ✅ |
| E16 boolean normalize | `ativo` cast para boolean no push | linha 374 | ✅ |
| E18 mutex sync | `syncPromise` em vez de só `syncing` | linha 298-313 com .finally() | ✅ (ver P2-N5) |
| E19 tokenStorage | prioriza in-memory; localStorage fallback | api.js readToken | ✅ (mas legacy syncManager.js + serverApi.js ainda usam direto — ver P2-A4) |
| E20 sanitizeMessage | redact paths/secrets em dialogs | main.js 81-90 | ✅ |
| E21 logs com rotação | arquivo + rotação 10MB | main.js 92-116 | ✅ |
| E22 logger sem body | sem body, redact token=...&senha=... em querystring | server.js 71-82 | ✅ |
| E23 stub 501 + auth | authMiddleware + 501 em métodos não-GET | server.js 98-113 | ✅ |
| E25 SYNC_INTERVAL clamp | Math.max(..., 10000) | syncService linha 271 | ✅ |
| E26 isPackaged | `ELECTRON_IS_PACKAGED` boolean | preload.js linha 38 | ⚠️ (env var nunca é setada em main.js → sempre `false`. Ver P2-A1) |
| E28 validateId middleware | regex + parseInt | validateId.js OK, mas **nenhuma rota usa `router.param('id', ...)`** — middleware existe mas é dead code. Ver P2-A2 | ❌ |
| E30 transação síncrona | trx síncrona no SQLite | database.js 168-189 | ✅ |

**Total: 22 ✅ · 2 ⚠️/❌ (E26, E28)**

---

## CRITICOS

### [P2-C1] `electron/main.js` `loadJwtSecret` cria arquivo DIFERENTE do `middleware/auth.js` em paths diferentes — JWT_SECRET re-gera a cada boot e invalida tokens

**Arquivos:** `SoftHair/electron/main.js:58-78` vs `SoftHair/backend/src/middleware/auth.js:24-67`

**Descrição:** Cada um persiste `secrets.json` num diretório **diferente**:
- `main.js`: `dataDir = path.join(app.getPath('userData'), 'SoftHair', 'database')` → ex. `~/.config/SoftHair/SoftHair/database/secrets.json` (NOTE: duplica `SoftHair`)
- `middleware/auth.js`: `dataDir = process.env.SOFTHAIR_DATA_DIR || path.join(__dirname, '..', '..', 'database')`

O fork passa `SOFTHAIR_DATA_DIR: dataDir` correto (linha 147), então o backend lê do mesmo path. **Mas main.js calcula em `userData/SoftHair/database`** com `SoftHair` duplicado (já que `app.getPath('userData')` em Electron retorna `~/.config/SoftHair` no Linux por causa do `productName: SoftHair`). Resultado: o segredo vive em `~/.config/SoftHair/SoftHair/database/secrets.json`. Acceitável, mas confuso e o vault não fala.

**Pior:** o main.js gera com `crypto.randomBytes(48).toString('hex')` (96 chars), e o middleware/auth.js também. Cada um lê seu próprio arquivo independentemente. **Se o backend embarcado é spawned com `JWT_SECRET` passado via env**, ambos usam o mesmo secret — OK. **Mas se o env não estiver passando (caso edge de fork falhar a herdar env), main.js já gerou um secret em "seu" caminho, e o backend gera OUTRO em paralelo** e cada um valida com sua chave. Pior: a janela de race entre `loadJwtSecret` no main.js e o fork inicial pode escrever em paralelo o mesmo arquivo (ver P2-C2).

**Exploração:** baixa probabilidade direta de exploit; mas em prática:
- usuário relata "login expira aleatoriamente" — sintoma de JWT_SECRET inconsistente
- ataque de força bruta facilitado se segredos colidirem ou se um deles for previsível por timing

**Fix:** Remover `loadJwtSecret` do main.js (não é usado pra nada — é gerado pra passar via env, mas o backend gera o seu mesmo se env não vier). Em vez disso, deixar SÓ `middleware/auth.js` cuidar, e main.js passa `SOFTHAIR_DATA_DIR` corretamente para o fork. Ou centralizar em um único módulo `lib/secrets.js`.

### [P2-C2] Race condition no startup: dois Electrons iniciam quase juntos antes do `requestSingleInstanceLock` resolver — `secrets.json` é escrito 2x

**Arquivo:** `SoftHair/electron/main.js:35-45, 58-78`

**Descrição:** `app.requestSingleInstanceLock()` é chamado **antes** de `app.whenReady()`. Mas:

1. O lock é por **process/app** — duas execuções do binário (clique duplo no ícone) vão ter dois `app.requestSingleInstanceLock()` retornando coisas diferentes: o primeiro pega, o segundo retorna `false` e dá `app.quit()`.
2. **MAS `loadJwtSecret` é chamado dentro de `startBackend()` que roda em `app.whenReady().then()`.**
3. Se o usuário clicar o ícone duas vezes em < 50ms, ambos os processos do Electron começam a inicializar. O segundo ainda lê o `app.requestSingleInstanceLock()` mas — porque `process.exit(0)` é chamado linha 38 — antes disso já passou da linha onde `whenReady` callback foi agendado? Não. O `if (!gotLock) { app.quit(); process.exit(0); }` é síncrono, logo depois do `requestSingleInstanceLock`. O `whenReady().then()` foi agendado mas ainda não executou. `process.exit(0)` mata o processo antes do `then` rodar. **Race janela teórica:** ~0ms na prática. ✅ não é exploit direto.

**Porém,** o backend faz outra cosa: o `middleware/auth.js` chama `loadOrGenerateSecret()` **no top-level do módulo** (linha 69). Se o backend iniciar e o arquivo `secrets.json` AINDA NÃO existir (primeiro boot), ele cria. Se concomitantemente o main.js (electron/main.js linha 138) chama `loadJwtSecret(dataDir)` e ESCREVE o mesmo path com OUTRO valor, o último write vence — e tokens já assinados ficam inválidos. O `fork` (linha 140) acontece **depois** de `loadJwtSecret` (linha 138), então `process.env.JWT_SECRET` está setado antes do backend rodar — a auth.js linha 25 (`if (process.env.JWT_SECRET && length >= 32) return`) é satisfeita e não regenera. **Por isso o problema acima é mitigado na prática.** ⚠️ mas se main.js falhar ANTES de escrever secrets.json (disk full, etc) e o backend conseguir, dão dois secrets diferentes.

**Fix:** o main.js só deve gerar/passar o secret. O backend NUNCA deve gerar o seu sozinho em prod — se env não vem, abortar (já é parcialmente o caso, linha 60-63 de auth.js). Centralizar a geração no main.js, mover `loadJwtSecret` para um módulo compartilhado, garantir atomicidade do write (`writeFileSync` + `renameSync`).

### [P2-C3] `getEncryptionKey()` em syncService usa `JWT_SECRET || 'fallback'` — se JWT_SECRET vier vazio o token cloud criptografa com chave `'fallback'` previsível

**Arquivo:** `SoftHair/backend/src/services/syncService.js:120-126`

```js
function getEncryptionKey() {
  const { JWT_SECRET } = require('../middleware/auth');
  return crypto
    .createHmac('sha256', JWT_SECRET || 'fallback')
    .update('softhair-sync-token-v1')
    .digest();
}
```

**Descrição:** Se por qualquer razão `JWT_SECRET` chegar como string vazia, `undefined` ou `null`, a função cai em `'fallback'`. HMAC-SHA256 com chave `'fallback'` + label fixo `'softhair-sync-token-v1'` gera **uma chave AES-256 determinística e conhecida do código-fonte**. Atacante que pegou o `sync-config.json` em disco descriptografa instantaneamente.

**Cenário:** boot com middleware/auth.js linha 65 — em ambiente de teste/CI ou Electron antes do middleware carregar, JWT_SECRET pode não estar resolvido na primeira chamada (CIRCULAR REQUIRE: syncService requires database, e quando algum require encontra syncService antes de auth, retorna `{}`).

**Fix:** falhar duro se JWT_SECRET não estiver disponível: `throw new Error('JWT_SECRET ausente — token criptografia indisponível')`. Pelo menos usar um secret aleatório efêmero (no boot) em vez de string fixa.

### [P2-C4] `loadConfig()` no construtor do `SyncService` chama `decryptToken()` que requer `JWT_SECRET` ainda não inicializado — circular dependency potencial

**Arquivo:** `SoftHair/backend/src/services/syncService.js:171-202`

**Descrição:** O singleton é instanciado em `module.exports = new SyncService();` (linha 452). O `constructor` chama `loadConfig()` → `decryptToken()` → `getEncryptionKey()` → `require('../middleware/auth')`. 

O ciclo de require:
1. `server.js` faz `require('./services/syncService')`
2. `syncService.js` faz `require('../config/database')` no top (linha 28) — OK
3. `syncService.js` exporta `new SyncService()` — construtor roda
4. Construtor chama `loadConfig` → `decryptToken` → `getEncryptionKey` → `require('../middleware/auth')` inline
5. auth.js executa `loadOrGenerateSecret()` → potencialmente cria `secrets.json`
6. Retorna `{ JWT_SECRET }` e continua

Isso funciona porque o require inline (dentro de `getEncryptionKey`) é lazy. **MAS** se houver mudança de ordem e algum outro módulo importar `syncService` antes de `auth.js`, o construtor roda primeiro e tenta resolver `auth.js` quando `auth.js` está sendo construído — caso clássico de circular dependency. Como auth.js não importa syncService, hoje OK. Vale lock.

**Fix:** mover criação do singleton para fora do require — adotar pattern `getSyncService()` lazy. Ou explicitamente garantir order de boot.

### [P2-C5] `applyRemoteChanges` confia em `localSalaoId = 1` hardcoded — se admin troca de salão (mesma instalação serve 2 salões) o sync vai sobrescrever dados cruzados

**Arquivo:** `SoftHair/backend/src/services/syncService.js:180, 399-409`

**Descrição:** `this.localSalaoId = 1` é hardcoded. O comentário diz "hardcoded em SQLite seed". A validação E6 só compara `sanitized.salao_id !== 1`. 

**Cenário 1:** se o usuário fizer um restore de backup que tenha rows com `salao_id = 2` (talvez por uma instalação anterior, multi-tenant não-suportado), o sync pull aceita silenciosamente (porque `localSalaoId === 2`? não, é 1, então rejeita).
**Cenário 2:** se o servidor cloud devolver dados de TODOS os salões (bug no server), o client filtra pelo `salao_id == 1`. OK.
**Cenário 3:** se o admin tem **dois salões na cloud** (multi-tenant) e o token JWT cloud tem `salaoId=2`, o client local salva esses dados como `salao_id=2` em SQLite — mas localSalaoId=1, então rejeita TUDO. Sync silenciosamente não faz nada.

**Não é exploit, mas é bug de UX que confunde — sync diz "0 changes" indefinidamente. Sem aviso.**

**Fix:** ler `localSalaoId` do JWT do usuário logado local, não hardcode. Ou logar warn quando o filtro descarta mais de X% dos rows.

### [P2-C6] `axios` no `_doSync` envia `Authorization: Bearer <token>` mas não valida `cert fingerprint` (TOFU prometido em E9 não implementado)

**Arquivo:** `SoftHair/backend/src/services/syncService.js:181, 284-292`

**Descrição:** `this.knownFingerprint` é declarado no constructor e gravado em `saveConfig`/`loadConfig`, mas **nunca é checado nem populado** em `_doSync`. Comentário promete TOFU (Trust On First Use), mas `buildAxiosConfig()` só seta `rejectUnauthorized: true`. Se o atacante MITM apresenta um cert válido emitido por qualquer CA pública (Let's Encrypt para `my-fake-render.com` que o usuário digitou) ou comprometeu o Render real, o cliente confia.

**Fix:** implementar TOFU de verdade — no primeiro sync sucesso, gravar `fingerprint` do peer cert (`tlsSocket.getPeerCertificate().fingerprint256`). Nas subsequentes, validar match. Se mudou, abortar e exigir re-autorização. Alternativa simpler: pin a `*.onrender.com` hardcoded para a default URL.

---

## ALTOS

### [P2-A1] `preload.js` retorna `isPackaged: () => process.env.ELECTRON_IS_PACKAGED === 'true'` mas **main.js nunca seta essa env var** → sempre retorna `false`

**Arquivo:** `SoftHair/electron/preload.js:38`

**Descrição:** `isPackaged()` é exposto via preload, mas o main.js (em nenhum lugar) seta `process.env.ELECTRON_IS_PACKAGED = 'true'` antes de criar a BrowserWindow. Resultado: o renderer sempre vê `false`. Se algum componente do frontend tomar decisão baseado nisso (ex.: mostrar "modo dev" badge ou habilitar/desabilitar features), o comportamento está errado.

**Fix:** em main.js, antes de criar a BrowserWindow, setar `process.env.ELECTRON_IS_PACKAGED = String(app.isPackaged)`. Ou expor `app.isPackaged` diretamente via IPC (preload usa ipcRenderer).

### [P2-A2] `validateId` middleware existe mas não está sendo aplicado em nenhuma rota — dead code (E28 não foi de fato fixado)

**Arquivo:** `SoftHair/backend/src/middleware/validateId.js` (existe)

**Descrição:** O middleware foi criado em Pass 1 e está exportado, mas **`grep router.param` em backend/src/routes/ retorna nada**, e nenhum `validateId` é importado. Rotas como `GET /clientes/:id` continuam passando `req.params.id` direto para o SQLite, e em Postgres causaria 500 com `"abc"`. Em SQLite SQLite coage tipos, mas semanticamente o middleware não está protegendo nada.

**Fix:** aplicar `router.param('id', validateId)` em cada router file (clientes, profissionais, servicos, produtos, agendamentos, atendimentos, vendas).

### [P2-A3] Frontend `syncManager.js` legacy ainda usa `localStorage.getItem('softhair_token')` + URL controlada por usuário sem validar HTTPS — duplicidade com novo `tokenStorage`

**Arquivo:** `SoftHair/frontend/src/syncManager.js:114, 205`, `SoftHair/frontend/src/services/serverApi.js:11, 54`

**Descrição:** Pass 1 corrigiu `services/api.js` para usar `tokenStorage` in-memory, mas existem **dois clientes paralelos**:
- `syncManager.js`: lê `localStorage.getItem('softhair_token')` e `softhair_server_url`, monta axios SEM interceptor, faz POSTs direto pro backend.
- `serverApi.js`: classe `SoftHairApiClient` com `localStorage.setItem('softhair_token', token)`.

Se algum lugar do app (notei pelo menos `pages/Configuracoes.jsx`) usar essas APIs paralelas, o token de admin local fica em localStorage **mesmo após E19**. Migration: o login só popula `'token'` key, não `'softhair_token'`. Mas se algum fluxo legado escrever em `softhair_token`, é leak.

Pior: `serverApi.js` setServerURL **aceita qualquer URL sem validar HTTPS** (`localStorage.setItem('softhair_server_url', url)`). E `syncManager.js` monta axios em `baseURL: localStorage.getItem('softhair_server_url') + '/api'` — string concat: se a key for `null`, `null + '/api'` = `'null/api'`, axios falha. Defeito + sem validation.

**Fix:** remover ou migrar `syncManager.js` e `serverApi.js` para usar `tokenStorage` e validação de URL. Idealmente deletar o legacy (verificar se algum import sobreviveu).

### [P2-A4] `frontend/src/services/api.js` ainda escreve `localStorage.setItem('token', token)` em login — migration incompleta de E19

**Arquivo:** `SoftHair/frontend/src/context/AuthContext.jsx:52`

**Descrição:** Comentário diz "localStorage continua como persistência entre reloads do Electron (sem alternativa segura em renderer com contextIsolation puro até IPC bridge ser feito)". Aceitável como roadmap, mas isso significa que o XSS issue de E19 **não foi de fato resolvido** — só foi parcialmente mitigado. Persiste:
- Token escrito em localStorage em todo login (linha 52)
- Token lido em todo refresh da página (linha 16)

O `tokenStorage` in-memory é só uma cache rápida; o canal de persistência continua localStorage e qualquer XSS lê.

**Fix:** implementar o IPC bridge prometido (preload expõe `secureGetToken/SetToken` via `safeStorage` no main process). É a única forma real de fechar E19.

### [P2-A5] Server backend embarcado responde requests onde `Host` header diz `evil.com:3001` — DNS rebinding mitigation incompleta

**Arquivo:** `SoftHair/backend/src/server.js:46-64, 130`

**Descrição:** CORS está bem (E7), mas DNS rebinding contorna CORS: o navegador conecta a `evil.com:3001` (que resolveu para `127.0.0.1`), envia request com `Host: evil.com:3001`. Como o backend ouve em 127.0.0.1 e CORS aceita `Origin: http://evil.com:3001`? Não aceita — `ALLOWED_ORIGINS` é fixo. **Mas** o navegador pode fazer **request sem `Origin` header** (simple request: GET sem credentials, ou cross-origin sem preflight). Como `cors` config tem `if (!origin) return callback(null, true)` (linha 57), aceita.

Combinado: site malicioso `evil.com` rebinda DNS para 127.0.0.1, faz `<img src="http://evil.com:3001/api/clientes">` (GET simples sem origin) → server responde, navegador renderiza erro (não é imagem), mas atacante mediu timing. Ou pior: a página externa faz `fetch('http://evil.com:3001/api/health')` que retorna 200 — leak de info.

Atacante NÃO consegue ler resposta de `/api/clientes` (precisa de Authorization), mas:
- `/api/health` revela existência do app
- timing pode revelar dados via cache attacks

**Fix:** middleware `Host` check — `if (!['localhost', '127.0.0.1'].includes(req.hostname)) return res.status(421).send('Misdirected')`.

### [P2-A6] Setup wizard `bootstrap-admin`: senha mínima de 8 chars sem complexidade — `'12345678'` aceita

**Arquivo:** `SoftHair/backend/src/routes/auth.js:21`

**Descrição:** `body('senha').isLength({ min: 8 })` aceita `12345678`, `password`, `aaaaaaaa`. Sem requisitos de maiúscula/minúscula/número/símbolo. Sem check contra dicionário de senhas comuns (top 1000). bcrypt(`'12345678'`) é trivial de quebrar com rainbow table de senhas comuns.

**Fix:** adicionar regex check `/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/` ou usar `zxcvbn` (npm) para score mínimo. Alternativa simpler: rejeitar top-100 senhas comuns.

### [P2-A7] `bootstrap-admin` endpoint: race entre o check `existing.n > 0` e o `INSERT` — dois POSTs concomitantes podem criar 2 admins

**Arquivo:** `SoftHair/backend/src/routes/auth.js:31-46`

**Descrição:** O fluxo é:
1. `SELECT COUNT(*) FROM usuarios WHERE ativo = 1` → 0
2. (gap)
3. `INSERT INTO usuarios ...`

Se duas requisições concorrentes passam pelo check antes da primeira `INSERT` commitar, ambas inserem. SQLite é serializado por single-writer (better-sqlite3), então **na prática** o INSERT vai falhar com UNIQUE constraint no email (se for o mesmo email) — mas se for emails diferentes, ambas passam. Cenário improvável (usuário precisa abrir 2 abas e mandar 2 forms ao mesmo tempo), mas viola invariante "só pode ter 1 admin no setup".

**Fix:** envolver em transaction com `INSERT ... WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE ativo = 1)` ou usar `BEGIN IMMEDIATE` na transação.

### [P2-A8] Sync `_doSync` em erro NÃO rejeita a promise — caller que faz `await syncNow()` nunca pega erros

**Arquivo:** `SoftHair/backend/src/services/syncService.js:316-351`

**Descrição:** `_doSync` retorna `{ success: false, error }` em catch, mas **resolve** a promise. Quem faz `await syncService.syncNow()` recebe um objeto, não throw. Endpoint `/sync/now` em `routes/sync.js:21-24` chama `syncService.syncNow()` e responde `{ success: result.success !== false }` — funciona. Mas `setInterval(() => this.syncNow().catch(() => {}))` ignora o `.catch` (porque não há rejection).

Não é bug crítico, é gap: erros de sync silenciosamente acumulam em `lastError` mas não interrompem o intervalo. Token expirado, 401 em loop, gera retries infinitos.

**Fix:** detectar 401 → desabilitar sync e setar `lastError = 'Token expirado — reconectar'`; UI mostra reconnect button.

---

## MEDIOS

### [P2-M1] electron-builder `extraResources` copia `backend/` inteiro incluindo `backend/.env` se existir — vaza credenciais no installer

**Arquivo:** `SoftHair/package.json:35-41`

**Descrição:** `extraResources: [{ from: "backend", to: "backend", filter: ["**/*", "!node_modules/.cache/**"] }]`. O filtro só exclui `node_modules/.cache`. **`backend/.env`** (se o dev tiver criado um localmente, contendo credenciais reais) é copiado pro installer e distribuído com cada build. `backend/node_modules` inteiro inclusive (sem filtro de devDependencies), o que infla o installer mas não é segurança.

**Fix:** adicionar `!.env`, `!.env.*`, `!*.log`, `!node_modules/{nodemon,*test*}/**` ao filter.

### [P2-M2] `asarUnpack: ["**/node_modules/better-sqlite3/**"]` — outros native modules ficam dentro do asar e não funcionam

**Arquivo:** `SoftHair/package.json:42-44`

**Descrição:** `bcryptjs` é JS puro, OK. Mas `helmet` não tem native, `pg` tem `pg-native` opcional, `multer` puro. **`uuid` ok.** Não há outros native modules atualmente. ✅ mas se adicionarem `bcrypt` (nativo), `sharp`, `node-canvas`, etc, o asar quebra silenciosamente.

**Fix:** documentar no package.json comentário; adicionar `*.node` glob como `asarUnpack`.

### [P2-M3] `backend/node_modules` em prod inclui devDependencies (nodemon) — bloat e superfície de ataque

**Arquivo:** `SoftHair/package.json:35-41`

**Descrição:** Pra um installer Windows, `nodemon` (devDep do backend) acaba copiado. ~15MB extra + binários executáveis (`nodemon` CLI) que podem ser invocados se houver execve do filesystem do app. Pequeno, mas garbage.

**Fix:** no script `dist`, fazer `cd backend && npm prune --production` antes de electron-builder.

### [P2-M4] `mainWindow.webContents.executeJavaScript` no menu navigate — código embutido no main process

**Arquivo:** `SoftHair/electron/main.js:285-287`

**Descrição:** `mainWindow.webContents.executeJavaScript(\`window.location.hash = '#${route}'\`)`. `route` vem de strings literais no template do menu (controle do dev), então não há injeção. **MAS** padrão pega — se um dia o menu for dinamicamente gerado a partir de dados do usuário, vira RCE no renderer. Vale virar `setUrl` via IPC.

**Fix:** usar `mainWindow.webContents.send('navigate', route)` + handler no renderer.

### [P2-M5] `axios.post(/sync/login-cloud)` em rotas/sync.js NÃO valida `r.data.data` antes de pegar `.token` — pode crashar

**Arquivo:** `SoftHair/backend/src/routes/sync.js:61`

**Descrição:** `const token = r.data?.data?.token;` — usa optional chaining, OK. Mas se `r.data` for `null` (Render retorna body vazio com 200), `token` é `undefined`, then `if (!token) return 401`. ✅ OK.

**MAS** `axios` por padrão lança em status >= 400. Se Render responder 500 com HTML (gateway timeout), `axios.post` rejeita, o catch da função (linha 67) responde 401 com `error.response?.data?.error || error.message`. Se `error.message` for "Maximum call stack size exceeded" por algum bug, expõe stack info. Não crítico.

**Fix:** wrap em try/catch já existe; só validar mais explicitamente o status code.

### [P2-M6] `getResourcePath` em main.js: em prod usa `process.resourcesPath`, em dev usa `path.join(__dirname, '..')` — userData path correto cross-platform?

**Arquivo:** `SoftHair/electron/main.js:47-55, 122`

**Descrição:** `app.getPath('userData')` retorna:
- macOS: `~/Library/Application Support/SoftHair`
- Linux: `~/.config/SoftHair`
- Windows: `%APPDATA%\SoftHair` (Roaming)

✅ correto. `dataDir = path.join(userData, 'SoftHair', 'database')` adiciona `SoftHair` duplicado (já que `productName: 'SoftHair'` no electron-builder). Resultado: `~/.config/SoftHair/SoftHair/database/local.db`. Aceitável, mas estranho. Aceitável de manter para não quebrar instalações existentes.

**Fix:** documentar; ou simplificar para `path.join(userData, 'database')`. Mas mudar agora corrompe migrações existentes.

### [P2-M7] `frontend/dist/index.html` precisa estar em sync com `frontend/index.html` (CSP) — build regenera

**Arquivo:** `SoftHair/frontend/dist/index.html` vs `SoftHair/frontend/index.html`

**Descrição:** O Vite build copia CSP do source. Se o source for atualizado e o build não rodar, o `dist/index.html` (que é o servido em prod) fica desatualizado. Pass 1 menciona "rebuild" mas não há check automático.

**Fix:** script `prebuild:electron` que valida CSP igualdade. Ou guardar CSP num arquivo único.

### [P2-M8] Logs em `electron/main.js appendLog` não rotacionam por data — só por tamanho 10MB

**Arquivo:** `SoftHair/electron/main.js:108-115`

**Descrição:** Arquivos `softhair-2026-05-13.log` viram `softhair-2026-05-13.log.1234567890.old` quando > 10MB. Mas o nome do dia muda no novo dia, então em prática o arquivo do dia anterior fica intacto. Rotação por data ok. **Mas o `.old` files nunca são limpados** — disk fill ao longo de anos.

**Fix:** purgar `.old` files com > 30 dias no startup.

### [P2-M9] `dialog.showErrorBox` ainda usado em main.js mesmo após sanitização — se app não tiver display (CI headless build), trava

**Arquivo:** `SoftHair/electron/main.js:133, 160, 240, 277, 183`

**Descrição:** `dialog.showErrorBox` requer GUI. Em CI ou em modo headless, isso bloqueia ou crasha. Não é crítico em prod (sempre há display), mas em build/test environments dá pau.

**Fix:** wrap em `if (!process.env.CI && !process.env.HEADLESS) dialog.showErrorBox(...)`.

### [P2-M10] Sync timestamps SQLite usam `datetime('now')` (UTC, sem TZ marker) — comparação com Postgres TIMESTAMPTZ pode falhar

**Arquivo:** `SoftHair/backend/src/config/initDb.js:37-38, 50-51, etc`

**Descrição:** `datetime('now')` produz `'2026-05-13 14:30:00'` (sem Z). Postgres `CURRENT_TIMESTAMP` produz `'2026-05-13 14:30:00+00'`. Comparação no `_doSync` (`since = this.lastSync || '1970-01-01T00:00:00'`) — SQLite faz string compare. `'2026-05-13 14:30:00' > '1970-01-01T00:00:00'` ? Sim (string compare). Mas se o server retornar ISO com `Z`, e o local sem, e o code usar `Date.parse`, dá problema.

**Fix:** usar `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` no initDb defaults. Já estava no Pass 1 fix list mas não foi aplicado.

---

## BAIXOS

### [P2-B1] `crypto.randomBytes(48).toString('hex')` produz 96 chars — desperdício; 32 bytes hex (64 chars) é mais que suficiente para HMAC-SHA256

**Arquivo:** `SoftHair/backend/src/middleware/auth.js:45`, `SoftHair/electron/main.js:65`

**Descrição:** 48 bytes = 384 bits — overkill para HS256 (que usa SHA-256, 256-bit). 32 bytes (256-bit) é o canônico.

**Fix:** `crypto.randomBytes(32).toString('hex')` (64 hex chars).

### [P2-B2] `applyRemoteChanges` upsertRow usa `SELECT id FROM ... WHERE id = ?` + `UPDATE`/`INSERT` — race entre 2 syncs (mitigado por mutex P2-N5, mas vale `INSERT ... ON CONFLICT DO UPDATE`)

**Arquivo:** `SoftHair/backend/src/services/syncService.js:420-436`

**Descrição:** SQLite suporta `INSERT INTO ... ON CONFLICT(id) DO UPDATE SET ...`. Pode evitar a query extra `SELECT id FROM`.

**Fix:** refactor para upsert atomic.

### [P2-B3] `loadConfig` em `SyncService` constructor é síncrono — bloqueia o boot do server por 50-100ms se arquivo tiver alguns MBs

**Arquivo:** `SoftHair/backend/src/services/syncService.js:186-202`

**Descrição:** `fs.readFileSync(CONFIG_FILE)` — `sync-config.json` é < 1KB normalmente. Não issue.

**Fix:** não-issue. Cosmético.

### [P2-B4] `disconnect()` reescreve `sync-config.json` com `'{}'` em vez de `unlinkSync` — arquivo vazio fica no disco

**Arquivo:** `SoftHair/backend/src/services/syncService.js:258-265`

**Descrição:** Cosmético. Arquivo `{}` não tem credenciais, mas indica que houve sync configurado antes.

**Fix:** `fs.unlinkSync(CONFIG_FILE)` em vez de escrever `'{}'`.

### [P2-B5] `loadJwtSecret` no main.js tem catch que só `console.error` mas retorna `crypto.randomBytes(48).toString('hex')` efêmero — tokens invalidam a cada boot

**Arquivo:** `SoftHair/electron/main.js:73-77`

**Descrição:** Se disk full ou permission denied ao escrever secrets.json, gera secret efêmero. Próximo boot gera outro, invalida todos os tokens. **Esperado**, mas o usuário não é avisado. O middleware/auth.js linha 60 também faz isso mas com `process.exit(1)` em prod.

**Fix:** consistir — main.js também deve `dialog.showErrorBox` + `app.quit()` se não conseguir persistir secret em prod.

### [P2-B6] `frontend/src/services/api.js readToken` cai em `localStorage.getItem(TOKEN_KEY)` se tokenStorage vazio — fonte dupla de verdade em todo refresh

**Arquivo:** `SoftHair/frontend/src/services/api.js:25-27`

**Descrição:** Toda vez que `axios` faz request, lê primeiro `tokenStorage` então `localStorage`. Se ambos tiverem (esperado depois do login), prefere `tokenStorage`. Se só localStorage tiver (refresh da página, antes do `AuthProvider` rodar), usa localStorage. Funciona, mas as duas fontes podem divergir se uma for limpa sem a outra (logout incompleto).

**Fix:** centralizar — `clearTokens()` (linha 29) limpa as duas, mas `setToken` precisa setar as duas explicitamente. Hoje só AuthContext faz isso. Audit completo do app pra garantir.

### [P2-B7] `package.json` `nsis: { oneClick: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, createStartMenuShortcut: true }` — installer pede UAC mas não remove userData no uninstall

**Arquivo:** `SoftHair/package.json:56-62`

**Descrição:** Default do NSIS — uninstaller não toca em `%APPDATA%\SoftHair`. Usuário desinstala mas o SQLite com clientes/profissionais/vendas continua no disco. Aceitável (preservar dados em reinstalação), mas idealmente pedir "Deseja remover os dados também?".

**Fix:** custom NSIS script `nsis: { script: 'build/installer.nsh' }` com prompt de deleção.

---

## Resumo

**Novos issues encontrados Pass 2:**

| Severidade | Count |
|---|---|
| Críticos | 6 (P2-C1 a P2-C6) |
| Altos | 8 (P2-A1 a P2-A8) |
| Médios | 10 (P2-M1 a P2-M10) |
| Baixos | 7 (P2-B1 a P2-B7) |
| **Total** | **31** |

**Verificação Pass 1:** 22/24 fixes confirmados funcionando. 2 com gaps:
- **E26** (`isPackaged`) — env var nunca setada, sempre retorna `false`. ⚠️
- **E28** (`validateId`) — middleware criado mas NÃO aplicado em nenhuma rota. ❌

**Áreas mais frágeis:**
1. **Schema drift** entre SQLite local e Postgres cloud — boolean e timestamps continuam divergindo (P2-M10).
2. **Migration incompleta de E19** (localStorage) — o IPC bridge prometido nunca foi feito; o tokenStorage in-memory só mitiga, não fecha (P2-A4).
3. **Legacy clientes paralelos** (`syncManager.js`, `serverApi.js`) ignoraram o Pass 1 inteiro — usam `localStorage` direto, sem validação de URL HTTPS (P2-A3).
4. **JWT_SECRET dual generation** entre main.js e middleware/auth.js — confuso, frágil, mas funciona na prática (P2-C1).
5. **Setup wizard sem complexity check** (P2-A6) e com race window (P2-A7).
6. **Cert pinning prometido em E9 nunca foi implementado** — `knownFingerprint` é dead state (P2-C6).

### Descobertas-chave

1. **Pass 1 deixou rastros (E26, E28) que não passaram do scaffold para o uso.** É comum em refactors apressados — middleware/preload API existe mas ninguém chama.

2. **Frontend tem 3 caminhos paralelos para falar com servidor:** `services/api.js` (atualizado em E19), `services/serverApi.js` (legacy localStorage), `syncManager.js` (legacy localStorage). Os dois legacy precisam morrer ou migrar.

3. **SQL injection / OWASP top 10:** sem novos vetores. Placeholders consistentes, queries parameterizadas. ✅

4. **DNS rebinding** ainda parcialmente exploitável (P2-A5) por causa de `if (!origin) return callback(null, true)` em CORS — simple requests sem Origin passam.

5. **Build/dist concerns:** `.env` pode vazar (P2-M1), `backend/node_modules` inclui devDependencies (P2-M3). Não é exploit direto mas afeta hygiene do installer.

6. **Race conditions no startup**: P2-C1, P2-C2, P2-C4 são todas variações do mesmo problema — múltiplos paths fazendo coisas overlap. Solução: centralizar geração/uso de secret em UM módulo.

### Áreas verificadas limpas

- **Helmet CSP**: ativo e correto (E13 confirmado).
- **Origin null aceito intencionalmente** para Electron file:// — mas combina mal com DNS rebinding (P2-A5).
- **Sync mutex** funciona (E18); finally bloco libera promise.
- **bcrypt cost 10** em bootstrap-admin e profissionais ok.
- **Express-validator** aplicado em rotas críticas.
- **Tenant isolation** em pull do sync (E6) ok (apesar do localSalaoId hardcoded — P2-C5).
- **shell.openExternal whitelist** funciona (E12).
- **setWindowOpenHandler + will-navigate** restrito (E15) ok.
- **No SQL injection** detectado em todas as rotas auditadas.
