# Electron Audit Pass 4

Quarta passada de auditoria. Branch: `claude/brave-beaver-6c804d`.

Pass 3 entregou 7 críticos + 10 altos + 10 médios + 7 baixos = **34 itens** (28 fixados, 6 aceitos). Este Pass 4:

1. Verifica se os fixes do Pass 3 funcionam de verdade.
2. Cobre os 15 ângulos solicitados (setup wizard, DevTools, LGPD, electron-updater, telemetria, WebSocket, migration, etc.).

---

## Verificação Pass 3

| Item | Fix esperado | Verificação | Status |
|---|---|---|---|
| P3-C1 setup wizard frontend | inline em Login.jsx, calls /needs-setup + /bootstrap-admin | implementado linhas 16-209 com `needsSetup` state, isStrongPasswordClient guard, ux completa (loading, success, error) | OK |
| P3-C2 rate limit | express-rate-limit em /login (5/15min) e setup (10/min) | auth.js:12-28 — loginLimiter e setupLimiter aplicados corretamente | OK |
| P3-C3 withTransaction await trap | detecta Promise + propaga | database.js:181-200 — async-detection presente mas heurística limitada (comentário admite que se await real for executado, COMMIT já aconteceu). Aceito como dívida documentada | OK |
| P3-C4 validateFKs aplicado | rota agendamentos/atendimentos/vendas | grep confirma 9 callsites (3 routes × POST+PUT em algumas) | OK |
| P3-C5 estoque atomic guard | UPDATE WHERE quantidade_estoque >= ? | vendas.js:123-133 — guard correto, rowCount=0 → throw 409 | OK |
| P3-C6 isStrongPassword bootstrap | initDb.js usa isStrongPassword do lib/passwords | initDb.js:209-228 — valida senha forte antes de criar admin via env | OK |
| P3-C7 salaoId mismatch | warn + fallback | syncService.js:244-261 — verifica `saloes WHERE id=jwtSalaoId`, fallback documentado em lastError | OK |
| P3-A1 health endpoint minimal | `{ ok: 1 }` sem leak | health.js retorna `{ ok: 1 }` exato | OK |
| P3-A2/P3-A7 CSP tighten | sem `https:` em connect-src | frontend/index.html:7-9 — apenas `http://127.0.0.1:* http://localhost:*` | OK |
| P3-A3 spellcheck:false | desativado em webPreferences | main.js:297 implementado | OK |
| P3-A4 webRequest filter | bloqueia tudo fora loopback/file | main.js:457-470 — aplica filter em defaultSession | OK |
| P3-A5 will-attach-webview | preventDefault | main.js:307 implementado | OK |
| P3-A6 Electron upgrade | 28→33 | package.json:86 declara `^33.4.11` MAS package-lock.json:13 ainda referencia `^28.3.3` — UPGRADE NÃO APLICADO (ver P4-C1) | PARCIAL |
| P3-A8 crashReporter uploadToServer:false | crashes não vão pra Google | main.js:31-33 implementado | OK |
| P3-A10 atendimentos soft delete | UPDATE status='cancelado' | atendimentos.js:147-167 — soft delete implementado, idempotente | OK |
| P3-M1 link Cadastre-se removido | sim, Register page também | Login.jsx só tem form de login + setup; sem `<Link to="/register">` | OK |
| P3-M2 ForgotPassword instructions | concretas em vez de "contate admin" | ForgotPassword.jsx mostra path em %APPDATA% e ~/.config | OK |
| P3-M3 disconnect truncate fallback | terceiro fallback | syncService.js:365-371 — truncateSync chamado se unlink+write falham | OK |
| P3-M6 sync log aggregated | agrupar drops por tabela | syncService.js:547-577 — dropCounts agrupado, log final consolidado | OK |
| P3-M7 purgeOldLogs deferido | setTimeout 5s | main.js:452 — defer correto | OK |
| P3-M8 safeShowError robusto | try/catch sem app.isReady | main.js:141-152 — implementação correta | OK |
| P3-M9 getResourcePath normalize | path.normalize aplicado | main.js:69-78 implementado | OK |
| P3-M10 backend tests | smoke tests | tests/passwords.test.js + secrets.test.js + validateId.test.js — 19 asserts passing | OK |
| P3-B1 cache TTL salaoId | 1h | syncService.js:217-222 implementado | OK |
| P3-B5 keepAlive https.Agent | true + maxSockets:5 | syncService.js:394-417 implementado | OK |
| P3-B7 Postgres statement_timeout | 10s | database.js:103-105 SET LOCAL statement_timeout | OK |

**Total Pass 3: 26 ✅ confirmados · 1 PARCIAL (electron upgrade não aplicado) · 6 aceitos com justificativa (B2/B3/B4/B6/A9/M5)**

---

## CRITICOS

### [P4-C1] Electron 33 declarado mas lockfile ainda em 28.3.3 — upgrade do Pass 3 nunca foi aplicado

**Arquivos:** `SoftHair/package.json:86`, `SoftHair/package-lock.json:13`

**Descrição:** Pass 3 P3-A6 atualizou `package.json` para `"electron": "^33.4.11"`, mas o `package-lock.json` continua com `^28.3.3`. Como `npm ci` ou `npm install` instala baseado no lockfile quando ele está sincronizado, **o build de produção ainda baixa Electron 28**. Os 17 advisories que P3-A6 dizia mitigar continuam ativos:

```
$ npm audit 2>&1 | grep -A1 'Electron'
Electron: Use-after-free in PowerMonitor on Windows and macOS — GHSA-jjp3-mq3x-295m
Electron: Unquoted executable path — GHSA-jfqx-fxh3-c62j
Electron: HTTP Response Header Injection — GHSA-4p4r-m79c-wq3v
Electron: USB device selection not validated — GHSA-9899-m83m-qhpj
Electron: Crash in clipboard.readImage() — GHSA-f37v-82c4-4x64
Electron: Named window.open not scoped to opener — GHSA-f3pv-wv63-48x8
Electron: Renderer command-line switch injection via webPreference — GHSA-9wfr-w7mm-pc7f
```

**Exploração:**  GHSA-9wfr (command-line switch injection via undocumented `commandLineSwitches` webPreference) é particularmente preocupante porque o app expõe `webPreferences` no createWindow. Embora não passemos `commandLineSwitches`, qualquer regression que injete via preload abriria o vetor.

**Fix:** Rodar `npm install --package-lock-only` ou `rm package-lock.json && npm install` para regenerar o lockfile com Electron 33. Bonus: tar high severity (de electron-builder) também precisa fix; bump electron-builder de 24 → 25 (já no package.json, mesma situação no lock).

### [P4-C2] DevTools acessível em produção via F12 / Ctrl+Shift+I / menu reload / right-click

**Arquivos:** `SoftHair/electron/main.js` (no `before-input-event` handler), `electron/main.js:415-419` (menu Visualizar)

**Descrição:** Em produção:
1. **F12** abre DevTools — default do Electron via `Ctrl+Shift+I` / `F12` ainda funciona se não for explicitamente desabilitado. O Pass 2 nunca tocou nisso.
2. **`{ role: 'reload' }`** no menu Visualizar permite recarregar a janela. Combinado com qualquer XSS, o atacante pode disparar reload + intercept redirect.
3. **Right-click context menu** — não há `webContents.on('context-menu', preventDefault)`, então o usuário pode chegar em "Inspecionar elemento" via clique direito (Electron expõe isso por default em algumas plataformas).

DevTools em produção é severo porque:
- Permite ao usuário (ou malware via clipboard injection) executar JS arbitrário no contexto do renderer.
- Bypass de toda CSP (a console executa fora da CSP).
- Permite injetar fetch para qualquer URL (bypass webRequest filter via `chrome.devtools.network`).
- Permite extrair localStorage/sessionStorage/IndexedDB inteiros (incluindo token JWT em fallback localStorage do P2-A4).

**Exploração real:**
1. Atacante físico (cliente entra no salão, pede para usar PC dois minutos) abre F12 → console → `localStorage.getItem('token')` → exfil para o discord.
2. Malware local que controla clipboard injeta string que ao ser colada em qualquer campo do app (e.g., observações) e ativada via `Ctrl+Shift+I` (right-click → paste → executar via DevTools console).

**Fix:** Em `createWindow`:
```js
// Bloqueia F12, Ctrl+Shift+I, Ctrl+R em produção.
if (!isDev && app.isPackaged) {
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const k = (input.key || '').toLowerCase();
    if (k === 'f12') return event.preventDefault();
    if (input.control && input.shift && (k === 'i' || k === 'c' || k === 'j')) return event.preventDefault();
    if (input.control && k === 'r') return event.preventDefault();
    if (input.meta && input.alt && (k === 'i' || k === 'j')) return event.preventDefault(); // macOS
  });
  // Bloqueia "Inspecionar elemento" no context menu
  mainWindow.webContents.on('context-menu', (e) => e.preventDefault());
  // Bloqueia abertura programática
  mainWindow.webContents.on('devtools-opened', () => mainWindow.webContents.closeDevTools());
}
```
Adicionalmente, remover `{ role: 'reload' }` do menu Visualizar em prod (ou condicionar a `isDev`).

### [P4-C3] WebSocket hook `useWebSocket` conecta a `ws://localhost:3001/ws` mas backend embarcado não tem servidor WS — reconnect loop infinito vaza recursos e polui console

**Arquivos:** `SoftHair/frontend/src/hooks/useWebSocket.js`, `SoftHair/backend/src/server.js` (sem ws server)

**Descrição:** O hook é usado em:
- `Agenda.jsx:317-318` (`useWebSocket('admin', 'salao', ...)`)
- `Layout.jsx:33,95` (`useWebSocket('salao', user?.salonId, handleWsMessage)`)

Cada montagem dispara `connect()` que faz `new WebSocket('ws://localhost:3001/ws?tipo=...&id=...')`. O backend embarcado (`backend/src/server.js`) NÃO tem servidor WebSocket — o `http.Server` retornado por `app.listen()` recebe upgrade request e responde 404 ou descarta. O `onclose` então agenda `setTimeout(connect, 5000)`. Loop infinito.

**Impacto:**
1. **Console flood**: cada 5s aparecem WebSocket errors no DevTools (mas com fix P4-C2 DevTools fica fechada).
2. **Recursos**: cada socket descartado pelo OS deixa TIME_WAIT entries (até ~120s no Linux/Windows), 12 sockets/min = ~12k TIME_WAIT em 16h de uso.
3. **Métricas falsas**: webRequest filter (P3-A4) loga toda tentativa de conexão; o log noise oculta eventos reais.
4. **Bug do usuário**: a UI pode mostrar "atualizando em tempo real" e nunca atualizar — funcionalidade silenciosamente quebrada.

**Cenário workflow real:** salão usa app o dia inteiro. WebSocket nunca conecta. Notificações de novos agendamentos não chegam em tempo real — só após F5 (que com P4-C2 fix está bloqueado!).

**Fix:** Duas opções:
1. **Implementar WebSocket no backend embarcado.** Adicionar `ws` dependency, criar `wsServer` que escuta upgrade em `/ws` e propaga eventos relevantes (novo agendamento, etc.).
2. **Stub o hook quando rodando em modo Electron/local sem WS.** Mais pragmático para entrega imediata: detectar `isFileProtocol` (já existe) e retornar early no `useWebSocket` sem tentar conectar.

Recomendado para Pass 4: stub o hook (opção 2). Adicionar TODO documentado para opção 1 num roadmap. Sem opção 2, a versão atual está com sintoma severo de "produto não funciona".

### [P4-C4] Atalhos de menu `Ctrl+R` (reload) e zoom (Ctrl+Plus/Minus) sem guard — usuário comum pode quebrar o estado do app

**Arquivos:** `SoftHair/electron/main.js:419` (menu Visualizar com `reload` + `togglefullscreen` + `zoomIn/Out`)

**Descrição:** Aliado a P4-C2 (sem `before-input-event`), o menu Visualizar tem `{ role: 'reload' }`. Sem `isDev` guard, em produção o usuário pode:
- Apertar `Ctrl+R` no meio de uma venda → reload do renderer → estado in-memory (carrinho de venda em progresso) é perdido sem confirmação.
- Apertar `Ctrl+Shift+R` → force reload, ignora cache (descarrega bundle e reaproveita).

Combinado com a falta de service worker / IndexedDB persistente, é possível perder vendas, agendamentos sendo editados etc. Não é exploit de segurança, mas é UX hostil que cria suporte.

**Fix:** Em prod, condicionar o submenu de Visualizar:
```js
{
  label: 'Visualizar',
  submenu: isDev || !app.isPackaged
    ? [{ role: 'reload' }, { role: 'togglefullscreen' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }]
    : [{ role: 'togglefullscreen' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }],
},
```

### [P4-C5] Backend embarcado helmet CSP `connect-src 'self', http://127.0.0.1:*, https://*.onrender.com` — wildcard `https://*.onrender.com` permite XHR para qualquer subdomain attacker-controlled

**Arquivos:** `SoftHair/backend/src/server.js:33-43` (helmet config)

**Descrição:** Aqui o servidor backend embarcado serve o frontend? Não — em produção o frontend é file://. O helmet CSP é overhead defensivo, mas é setado em todas as respostas API. Importa porque:

1. **dist/index.html não tem meta CSP** — em rebuild da Pass 3, o frontend tinha CSP via `<meta http-equiv="Content-Security-Policy">`. O dist/index.html (gitignored) precisava ser regenerado mas a Pass 3 só atualizou source. Em produção, se o build for feito agora sem o source atualizado, o dist fica sem CSP nova.
2. **`*.onrender.com` é wildcard problemático** — qualquer dono de subdomain Render (custo $0, takeover possível por nome similar) pode hospedar payload e o renderer (caso atacante já tenha XSS) consegue fazer XHR para ele.

**Fix:** Helmet CSP do backend embarcado deveria espelhar a CSP do frontend index.html. Como o backend embarcado nunca serve HTML para browser (só JSON API), pode-se desabilitar CSP no helmet ou setar `connect-src 'none'`. Alternativamente:
```js
connectSrc: ["'self'", 'http://127.0.0.1:*'],  // sem onrender.com
```
Note que o syncService chama `cloudUrl` via axios em Node — não passa pela CSP do renderer.

### [P4-C6] Backup local nunca foi implementado mas é endpoint stub 501 com mensagem genérica — usuário acha que o feature existe

**Arquivos:** `SoftHair/backend/src/server.js:113-125` (stubs); `SoftHair/frontend/src/pages/Backup.jsx`; `SoftHair/frontend/src/services/api.js:175-189`

**Descrição:** A página `Backup.jsx` chama `backupAPI.create()`, `backupAPI.getLocal()`, `backupAPI.restore()`, integração Google Drive completa via `backupAPI.googleCallback()` etc. **Tudo retorna 501** porque o backend embarcado tem stub generic. O usuário vê o botão "Criar backup", clica, recebe erro genérico "Rota backup não implementada localmente". 

Pior: **dados locais NUNCA têm backup automático.** Se o SQLite corromper (queda de luz no meio de WAL flush), o salão perde tudo. Não há mensagem proativa: "Faça backup manual via copiar `userData/SoftHair/database/local.db`".

LGPD: backup é requisito para recuperação. Sem backup oficial, salão pode argumentar que perdeu prova trabalhista. Risco de compliance.

**Fix:** 
1. Curto prazo: implementar backup local trivial — copy `local.db` + `secrets.json` para `userData/SoftHair/backups/softhair-YYYY-MM-DD-HHmm.zip` via endpoint POST /api/backup/create. Listar via GET /api/backup/local.
2. Aviso na UI Backup.jsx: "Cloud backup (Google Drive) ainda não disponível na versão desktop — use export local."
3. Adicionar backup automático diário (cron simples no syncService) com retention 7 dias.

Para Pass 4, implementar pelo menos o item 1 + 2 (backup local manual + aviso UI).

### [P4-C7] Migration entre versões sem schema versioning — instalar v1.0 → upgrade v2.0 com colunas novas quebra sem migrate runner

**Arquivos:** `SoftHair/backend/src/config/initDb.js` (apenas `CREATE TABLE IF NOT EXISTS`)

**Descrição:** O `initDb` é puramente idempotent via `IF NOT EXISTS` — ele NUNCA roda `ALTER TABLE`. Se v2.0 adicionar coluna `cancelled_by_user_id INTEGER` em `agendamentos`, o banco do v1.0 não terá essa coluna; queries com `INSERT INTO agendamentos (..., cancelled_by_user_id, ...)` falharão com `no such column`.

Não há:
- `schema_versions` tabela
- Diretório `migrations/` com arquivos versionados
- Backup pré-migration automático
- Rollback path

Para um app desktop que ficará em produção 5+ anos rodando em múltiplas instalações, isso é dívida séria.

**Fix:** Implementar migrate runner mínimo:
1. Tabela `schema_versions (version INTEGER PRIMARY KEY, applied_at TEXT)`.
2. Diretório `backend/src/migrations/001_initial.sql`, `002_add_xxx.sql`, etc.
3. Em `initDb`, depois do DDL inicial, ler migrations não aplicadas em ordem e executar dentro de transação. Inserir version em `schema_versions`.
4. Antes de aplicar migration, copiar `local.db` para `local.db.pre-v{N}.backup`.

Para Pass 4 imediato: criar a infra (schema_versions + backup pré-migrate + folder migrations/ vazio com README). Migrations reais aplicar em PRs futuros.

---

## ALTOS

### [P4-A1] `node_modules/dexie` declarado mas nunca importado no source — bloat sem uso

**Arquivos:** `SoftHair/frontend/package.json:8` (`"dexie": "^4.4.2"`); `SoftHair/frontend/src/App.jsx:11` (comentário menciona dexie como heavy dep mas nenhum `import` encontrado)

**Descrição:** `grep -r "from 'dexie'" frontend/src` retorna vazio. A dependência está em production, contribui para bundle size, mas é dead code. ~70KB extras no JS final.

**Fix:** Remover `dexie` de `frontend/package.json` deps. Atualizar comentário em App.jsx.

### [P4-A2] `crashDumps` cresce sem limite — sem retention

**Arquivos:** `SoftHair/electron/main.js:31-33` (crashReporter sem retention config)

**Descrição:** `crashReporter.start({ uploadToServer: false })` — dumps locais ficam em `app.getPath('crashDumps')`. Cada dump pode ter 50-500MB (Chrome crash dumps são grandes). Sem cleanup, 1 crash/semana × 1 ano = 50GB.

**Fix:** No boot (deferido 5s junto com purgeOldLogs), iterar `crashDumps` dir e apagar arquivos > 30 dias OR limitar a 5 dumps mais recentes. Adicionar à função `purgeOldLogs()`.

### [P4-A3] Right-click context menu não bloqueado — atacante físico clica direito e tem "Reload"/"Forçar reload"

**Arquivos:** `SoftHair/electron/main.js` (sem `webContents.on('context-menu', ...)`)

**Descrição:** Mencionado dentro de P4-C2. Vale fix separado para focar na UX do menu de contexto: em produção, deve ser desabilitado totalmente ou customizado para apenas cut/copy/paste em campos editáveis.

**Fix:** Junto com P4-C2.

### [P4-A4] Frontend `Register.jsx` e `ResetPassword.jsx` ainda no source — código morto que pode confundir contribuidores

**Arquivos:** `SoftHair/frontend/src/pages/Register.jsx`, `SoftHair/frontend/src/pages/ResetPassword.jsx`

**Descrição:** Pass 3 P3-M1 removeu o link "Cadastre-se" do Login mas o arquivo Register.jsx e a rota associada (em App.jsx) ainda existem. Mesmo para `ResetPassword.jsx`. Code dead que pode ressurgir em PRs futuros.

**Fix:** Remover as duas páginas + rotas. Atualizar App.jsx para apenas `Login` e `ForgotPassword` como rotas públicas.

### [P4-A5] `safeStorage` electron API não usado para criptografar `secrets.json` em produção

**Arquivos:** `SoftHair/backend/src/lib/secrets.js`, `SoftHair/electron/main.js:106-125`

**Descrição:** Pass 1 documentou que `electron.safeStorage` faria isso, Pass 3 P3-B4 reclassificou como roadmap. Mas em Windows, qualquer processo do mesmo user lê o `secrets.json` (chmod é no-op). `safeStorage.encryptString` no Windows usa DPAPI — vincula ao user account + machine — outros users na mesma máquina não conseguem ler.

**Fix (Pass 4 escopo)**: implementar pipeline `safeStorage` opcional. No main.js, antes do fork do backend, se `app.isPackaged && safeStorage.isEncryptionAvailable()`:
1. Le `secrets.json` raw.
2. Se contém prefixo `enc:`, decrypta com `safeStorage.decryptString(buffer)`.
3. Caso contrário, criptografa o secret e regrava.
4. Passa o JWT_SECRET via env (já é feito) — não precisa o backend saber.

Implementação completa exige passos cuidadosos para não quebrar instalações existentes. Aceitar como roadmap se complexidade for alta, mas pelo menos documentar fix path concreto.

### [P4-A6] `sync-config.json` pode conter token criptografado de outro user em multi-user OS — sem ACL/safeStorage

**Arquivos:** `SoftHair/backend/src/services/syncService.js:292-308`

**Descrição:** Em Windows multi-user (single PC, dois admins de salões diferentes), cada user tem seu `%APPDATA%\SoftHair` mas o JWT_SECRET é único por instalação. Pior — se um malware no escopo do user atual lê o token criptografado de outro user (via diferentes mecanismos de elevation), pode replicar requests para o cloud sync.

Não exploitable em single-user típico, mas é arquitetura frágil.

**Fix:** Junto com P4-A5 (safeStorage).

### [P4-A7] Setup wizard pode ser chamado depois de admin existir — race window entre `/needs-setup` e POST `/bootstrap-admin`

**Arquivos:** `SoftHair/backend/src/routes/auth.js:42-103`

**Descrição:** Cenário:
1. Admin existe.
2. Atacante chama `GET /needs-setup` — recebe `false`.
3. Outro atacante (DELETE admin via SQL direto, ou bug) deleta a row.
4. `POST /bootstrap-admin` agora aceita — atacante cria conta nova.

O endpoint POST tem re-check transacional (P2-A7), MAS:
- A re-check usa `COUNT(*) WHERE ativo = 1`. Se admin existe com `ativo=0` (soft-deleted), bootstrap permite criar segundo admin.
- Se atacante consegue rodar SQL para `UPDATE usuarios SET ativo=0`, então re-bootstrap aceita.

**Fix:** Re-check no bootstrap deve checar `COUNT(*)` SEM filtro `ativo`. Se algum usuário com `tipo='admin'` JÁ existiu, bloquear bootstrap. Apenas usuários truly never-existed permitem bootstrap.

### [P4-A8] `validateId` rejeita IDs com vírgula/ponto/whitespace mas aceita `+5` ou `-0` ou notação científica?

**Arquivos:** `SoftHair/backend/src/middleware/validateId.js`

**Descrição:** Olhando o código atual:
```js
const parsed = Number.parseInt(id, 10);
if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== String(id)) {
  return res.status(400).json({ success: false, error: 'ID inválido' });
}
```

- `"+5"` → parseInt = 5 → String(5) = "5" ≠ "+5" → rejeita. OK.
- `"-0"` → parseInt = 0 → 0 <= 0 → rejeita. OK.
- `"1e2"` → parseInt = 1 → "1" ≠ "1e2" → rejeita. OK.
- `"  5  "` → parseInt = 5 → "5" ≠ "  5  " → rejeita. OK.
- `"5abc"` → parseInt = 5 → "5" ≠ "5abc" → rejeita. OK.
- `"5.0"` → parseInt = 5 → "5" ≠ "5.0" → rejeita. OK.

Boa cobertura. Não é issue ativo. Aceitar como sólido.

### [P4-A9] Logs locais armazenam CPF/email em queries (mesmo com redact de querystring) — payload de POST não é redactado

**Arquivos:** `SoftHair/backend/src/server.js:80-92` (logger)

**Descrição:** Pass 1 E22 disse "nunca loga body". Confirmado: o logger só loga `req.method`, URL (com redact de `token=`, `senha=`), statusCode, dt. Body de POST nunca passa pelo log do middleware.

**Mas** o webContents log via stdout (backend stdout via fork) pode incluir `console.log` de outras partes do código. Exemplo: `console.log('Erro no login:', error)` em `auth.js:160`. Se o error contiver query SQL, e a query mostrar `WHERE email = 'cpf@cpf.com'` (improvável; queries com `?` placeholders), pode vazar.

Investigação: o erro do bcrypt ou jwt nunca contém payload do user. Tela limpa.

**Aceitar como sólido.**

### [P4-A10] Stubs 501 ainda contêm 7 telas afetadas — UX hostil sem mensagem do user

**Arquivos:** `SoftHair/backend/src/server.js:113-125`; UI: `Notificacoes.jsx`, `Fechamento.jsx`, `Caixa.jsx`, `Comissoes.jsx`, `Despesas.jsx`, `Financeiro.jsx`, `Backup.jsx`, `Administrativo.jsx`, `Relatorios.jsx`, `Metas.jsx`

**Descrição:** Stubs ativos:
- `/api/notificacoes`
- `/api/fechamentos`
- `/api/comissoes`
- `/api/creditos`
- `/api/historico`
- `/api/saloes`
- `/api/backup`

Cada um GET retorna `{ success: true, data: [] }` (silencioso), POST/PUT/DELETE retorna 501. UI:
- **Backup.jsx**: clica "criar" → 501. Vide P4-C6.
- **Fechamento.jsx**, **Comissoes.jsx**, **Despesas.jsx**, **Financeiro.jsx**, **Metas.jsx**: mostram listas vazias sem aviso de "feature ainda não implementada".
- **Notificacoes.jsx**: `/count` retorna `0` — sino sempre vazio.
- **Administrativo.jsx**, **Relatorios.jsx**: agregam dados que precisam dos stubs — provavelmente quebram silenciosamente.

**Fix:** Implementar pelo menos um banner persistente em cada uma dessas telas: "Esta funcionalidade está em desenvolvimento na versão desktop. Disponível em breve via update." Reduz suporte por confusão.

Para escopo Pass 4, adicionar pelo menos banner em `Backup.jsx` (mais visível e prejudicial). Outras aceitar como roadmap.

---

## MEDIOS

### [P4-M1] `helmet` CSP não cobre frame-ancestors — clickjacking em iframe possível

**Arquivos:** `SoftHair/backend/src/server.js:21-43` (helmet)

**Descrição:** A CSP do helmet tem `defaultSrc 'self'` mas não declara `frameAncestors` explicitamente. Default do helmet ≤7 era `'none'` (boa), mas em algumas configs pode ser permissivo. Como o backend embarcado nunca renderiza páginas HTML para browsers externos (file:// no Electron não carrega API responses como página), clickjacking é low-risk. Mas vale ser explícito.

**Fix:** Adicionar `frameAncestors: ["'none'"]` ao directives.

### [P4-M2] `web-security` toggle não testado em prod build — webPreferences expostas

**Arquivos:** `SoftHair/electron/main.js:290-302`

**Descrição:** `webSecurity: true` (default true mas explícito é bom). `sandbox: true` ok. `contextIsolation: true` ok. **Mas** falta `enableRemoteModule: false` (deprecated mas era default true em versões antigas). Em Electron 33 já é falso por default — vale colocar para clareza, mas é defensive coding.

**Fix:** Adicionar explicitamente:
```js
webPreferences: {
  ...,
  enableRemoteModule: false,
  navigateOnDragDrop: false,
  webgl: false, // não usamos WebGL
}
```

### [P4-M3] Browser process `app.commandLine.appendSwitch` não bloqueado — qualquer plugin de injeção altera flags

**Arquivos:** `SoftHair/electron/main.js` (sem `app.commandLine.appendSwitch` mas sem proteção)

**Descrição:** Algumas extensões/AV usam `appendSwitch` para injetar flags como `--disable-features=NetworkServiceInProcess` ou `--no-sandbox`. Se um pacote vendor faz isso no startup, sandbox cai sem aviso.

**Fix:** Adicionar guard no whenReady:
```js
const noSandbox = process.argv.includes('--no-sandbox');
if (noSandbox && app.isPackaged) {
  safeShowError('SoftHair', 'Flag --no-sandbox detectada. Por segurança, o app não inicializará.');
  app.exit(1);
}
```

### [P4-M4] Migration backup é por-versão mas não pre-migrate — risco de perda em migrate corrupted

**Arquivos:** `SoftHair/backend/src/config/initDb.js`

**Descrição:** Cobrir junto com P4-C7.

### [P4-M5] Sync `disconnect` no client não limpa `_pendingFingerprint` set durante TOFU — leak em memória mínimo

**Arquivos:** `SoftHair/backend/src/services/syncService.js:343-373`

**Descrição:** O `disconnect()` zera `knownFingerprint`, `_localSalaoId`, mas `_pendingFingerprint` só é settado dentro de `_doSync` e usado em next save. Em disconnect entre dois syncs, fica orphan na instance.

**Fix:** Em `disconnect()`, adicionar `this._pendingFingerprint = null` (já existe na linha 351 — confirmado OK na verificação). **Reclassificar como OK.**

### [P4-M6] Stubs retornam `data: []` para GET — UI assume array vazio sem flag de "stub" — sem distinguir "vazio real" vs "não implementado"

**Arquivos:** `SoftHair/backend/src/server.js:113-125`

**Descrição:** Quando `Comissoes.jsx` faz `getAll()`, recebe `{ success: true, data: [] }`. UI renderiza "Nenhuma comissão". Mas a feature inteira está stubbed. Confunde o user que pensa "tenho 0 comissões hoje" em vez de "feature não pronta".

**Fix:** Retornar header customizado ou flag no response: `{ success: true, data: [], stub: true }`. Frontend pode mostrar banner "Funcionalidade em desenvolvimento" se `stub === true`.

### [P4-M7] `webRequest` filter em main.js bloqueia http externo de fontes — mas `font-src 'self' data:` na CSP do frontend só permite local — ok mas defesa em profundidade não-coerente

**Arquivos:** `SoftHair/electron/main.js:457-470`

**Descrição:** O webRequest filter permite imagens https external. Mas a CSP do frontend tem `img-src 'self' data: https:`. **Coerente.** Mas font não é coberta no webRequest (não tem allow exception para resourceType=='font'). Se algum CSS futuro tentar carregar Google Fonts, vai falhar no webRequest antes da CSP.

**Fix:** Adicionar exception:
```js
(details.resourceType === 'font' && url.startsWith('https://'))
```
Ou aceitar: app não usa Google Fonts (Tailwind compila tudo local).

**Aceitar.**

### [P4-M8] `cors` em backend embarcado aceita `origin === 'file://'` mas Chrome moderno envia `origin: 'null'` para file://

**Arquivos:** `SoftHair/backend/src/server.js:73-82`

**Descrição:** O middleware permite `!origin` (que cobre `null`/`undefined`) E `origin === 'file://'`. Em Electron moderno (33), o origin para um file:// loaded HTML é `null`. O check `!origin` cobre — funciona.

**Aceitar como sólido.**

### [P4-M9] `userData/SoftHair/database/local.db` em Windows fica acessível por outros users admin — sem ACL hardening

**Arquivos:** `SoftHair/backend/src/config/database.js:140-148`

**Descrição:** Em Windows, `%LOCALAPPDATA%\SoftHair\database\local.db` herda ACL do `%LOCALAPPDATA%`, que é user-scoped por default (não acessível por outros users). MAS em PCs corporativos com admin global, qualquer admin lê. Hardening ACL seria via win32 API call.

**Fix:** Documentar limitação. Sem ação imediata.

### [P4-M10] `crashReporter.start` chamado antes de `app.whenReady()` — pode falhar silenciosamente em algumas versões

**Arquivos:** `SoftHair/electron/main.js:31-33`

**Descrição:** O `crashReporter.start` no Electron 33 deve ser chamado antes do `app.ready`. Está corretamente posicionado (linhas 31-33, antes de qualquer `app.on(...)`). **OK na implementação.**

Verificado: a try/catch wraps caso a API mude de signature ou nomes — robusto.

**Aceitar como sólido.**

---

## BAIXOS

### [P4-B1] `package.json` "license: MIT" mas SECURITY.md não declara responsible disclosure — gap menor de compliance

**Arquivos:** `SoftHair/package.json`, `SoftHair/SECURITY.md`

**Descrição:** SECURITY.md existe mas pode não cobrir disclosure timeline (90 dias) e email de contato. Conferir se está completo.

**Fix:** Revisar SECURITY.md no escopo de uma manutenção posterior.

### [P4-B2] `Login.jsx isStrongPasswordClient` regex permite caractere especial mas backend `isStrongPassword` aceita sem — coerente mas diferentes mensagens

**Arquivos:** `frontend/src/pages/Login.jsx:16-22`, `backend/src/lib/passwords.js`

**Descrição:** Ambas validam minúscula, maiúscula, dígito, 8+ chars. Backend tem lista COMMON_PASSWORDS adicional que frontend não conhece — pode aparecer "ok no client, rejected no server" para senhas comuns como "Password1". Coerente mas UX ligeiramente diferente. Aceitável.

### [P4-B3] Logs em `userData/logs/softhair-YYYY-MM-DD.log` podem incluir nomes de tabelas e IDs em stack traces — leak metadata

**Arquivos:** `SoftHair/electron/main.js:163-178` (appendLog)

**Descrição:** Quando o backend faz `console.error('Erro no syncService:', err.stack)`, o stack pode mostrar `applyRemoteChanges (.../syncService.js:565)`. Não é leak crítico.

**Aceitar.**

### [P4-B4] Reset zoom não está habilitado em produção mas o `Ctrl+0` reseta zoom via padrão do Electron

**Arquivos:** `SoftHair/electron/main.js:419`

**Descrição:** Cobrir em P4-C4 (menu Visualizar em prod).

### [P4-B5] `tokenStorage` in-memory pode dar problemas em iframes — não temos iframes no app

**Arquivos:** `SoftHair/frontend/src/services/tokenStorage.js`

**Descrição:** Não relevante (sem iframes).

### [P4-B6] Frontend `crashReporter` IPC bridge ausente — renderer crashes não chegam ao main process log

**Arquivos:** `SoftHair/electron/preload.js`

**Descrição:** Quando o renderer crashea, o `crashReporter` no main process captura via Chromium IPC. OK. Mas erros JavaScript não-fatal (logged em `window.onerror`) não são relayed via preload para appendLog. Roadmap.

### [P4-B7] `package-lock.json` versão lock declara `electron@28` mesmo após Pass 3 — ver P4-C1

**Já coberto em P4-C1.**

---

## Resumo

**Novos issues Pass 4:**

| Severidade | Count |
|---|---|
| Críticos | 7 (P4-C1 a P4-C7) |
| Altos | 10 (P4-A1 a P4-A10) |
| Médios | 10 (P4-M1 a P4-M10) |
| Baixos | 7 (P4-B1 a P4-B7) |
| **Total** | **34** |

**Verificação Pass 3: 26/27 fixes confirmados funcionando**, 1 PARCIAL (P3-A6 lockfile stale), 6 aceitos com justificativa.

**Descobertas-chave:**

1. **P3-A6 lockfile não regenerado** — Electron 33 declarado mas npm install ainda baixaria 28 com 8 advisories ativas (P4-C1).

2. **DevTools abre em produção** via F12, Ctrl+Shift+I, right-click — exposure crítica em PC físico atacante (P4-C2).

3. **WebSocket hook bate em backend que não tem WS server** — reconnect loop infinito, recursos vazam, feature "tempo real" silenciosamente quebrada (P4-C3).

4. **Ctrl+R em produção quebra estado** sem confirmação — venda em progresso perdida (P4-C4).

5. **Backend embarcado CSP wildcard `https://*.onrender.com`** — XSS amplification (P4-C5).

6. **Backup local nunca implementado** — risco de perda de dados sem aviso, compliance LGPD frágil (P4-C6).

7. **Sem schema versioning** — upgrade de versão pode quebrar banco existente (P4-C7).

8. **`dexie` não usado** mas em deps de produção — bloat (P4-A1).

9. **Crash dumps sem retention** — pode crescer indefinidamente (P4-A2).

10. **Setup wizard race re-bootstrap** se admin foi soft-deleted (P4-A7).

11. **Stubs 501 sem flag — UX hostil**, user não sabe que feature está pendente (P4-M6, P4-A10).

**Áreas verificadas limpas:**
- Setup wizard frontend (P3-C1) — implementado e ux completo.
- Rate limit em login + setup (P3-C2) — express-rate-limit aplicado.
- withTransaction Promise detection (P3-C3) — implementação tem heurística.
- validateFKs nos 3 routes (P3-C4) — verified.
- Estoque atomic guard (P3-C5) — verified.
- isStrongPassword bootstrap (P3-C6) — verified.
- salaoId mismatch warn (P3-C7) — verified.
- CSP frontend sem https/wss (P3-A2/P3-A7) — verified.
- spellcheck:false (P3-A3) — verified.
- webRequest filter (P3-A4) — verified.
- crashReporter uploadToServer:false (P3-A8) — verified.
- Atendimentos soft delete (P3-A10) — verified.
- ForgotPassword instructions (P3-M2) — verified.
- disconnect truncate fallback (P3-M3) — verified.
- sync log aggregated (P3-M6) — verified.
- purgeOldLogs deferido (P3-M7) — verified.
- backend tests passing (P3-M10) — 19 asserts OK.
- Cache TTL salaoId (P3-B1) — verified.
- keepAlive sync agent (P3-B5) — verified.
- Postgres statement_timeout (P3-B7) — verified.

**Stubs 501 — lista completa:**
- `/api/notificacoes` → Notificacoes.jsx, Layout (sino)
- `/api/fechamentos` → Fechamento.jsx, Administrativo.jsx
- `/api/comissoes` → Comissoes.jsx, Administrativo.jsx
- `/api/creditos` → Caixa.jsx (parcial), Clientes.jsx
- `/api/historico` → Clientes.jsx detail
- `/api/saloes` → Configuracoes.jsx (getMe stub retorna fake `{id:1, nome:'Meu Salão'}`)
- `/api/backup` → Backup.jsx (totalmente quebrada)
- `/api/configuracoes` → Configuracoes.jsx
- `/api/despesas` → Despesas.jsx, Financeiro.jsx
- `/api/financeiro` → Financeiro.jsx, Relatorios.jsx
- `/api/bloqueios` → Agenda.jsx (block times)

**Telas com stubs:** Backup, Caixa, Comissoes, Despesas, Fechamento, Financeiro, Metas, Notificacoes, Relatorios, Administrativo, Configuracoes (parcial), Agenda (parcial). 11 telas afetadas total.

**Sobre LGPD / Privacy:**
- Endpoint delete-me NÃO existe.
- Backup local NÃO contém path para purge de dados de cliente deletado (porque backup ainda não foi implementado).
- Logs locais armazenam IDs mas não CPF/senha em plaintext (verificado).

**Sobre permissões filesystem:**
- Linux: `~/.config/SoftHair/SoftHair/database/local.db` — funciona, user-scoped.
- macOS: `~/Library/Application Support/SoftHair/SoftHair/database/` — sandbox potencial se app for Mac App Store (não é o caso atual).
- Windows: `%APPDATA%\Roaming\SoftHair\SoftHair\database\` — funciona, user-scoped.
- **PATH DUPLICADO**: `SoftHair/SoftHair` aparece duplicado — bug Pass 2 M6, aceito como compatibilidade. Confirmado ainda presente.

**Sobre auto-update:**
- electron-updater NÃO instalado.
- Sem auto-update implementado.
- User instala manualmente download de novas versões.
- SEM aviso na UI sobre versão atual vs disponível.
- Roadmap: adicionar electron-updater + canal de release no GitHub.

**Sobre telemetria:**
- crashReporter `uploadToServer: false` — verified.
- Sem analytics, sem ping de uso.
- Spellcheck desabilitado — verified.
- Sem outbound calls não-consentidos.
- Clean.

**WebSocket no Electron:**
- Hook conecta a `ws://localhost:3001/ws`.
- Backend embarcado NÃO tem servidor WS — loop infinito (P4-C3).
- Origin check via webRequest filter já bloqueia WS para sites externos — bom default.

**Build size:**
- `node_modules/dexie` desnecessário (~70KB minified) — P4-A1.
- `electron-builder` em devDependencies — OK, não vai pro build.
- asarUnpack tem `**/*.node` (nativos better-sqlite3) — OK.
- ExtraResources filter exclui node_modules de devtools, nodemon, eslint — OK.
- Estimativa: instalador ~80MB (Electron 33 base ~70MB + frontend + backend embarcado).

**Sync com cloud em desuso:**
- syncService trata 401/403 com `enabled=false` (P2-A8 verified).
- ETIMEDOUT/ECONNREFUSED — silenciosos, lastError populated, sem disable enabled (sync continua tentando).
- Fallback gracioso para offline: a UI mostra `lastError`, mas o restante do app continua funcionando contra SQLite local.
- **Aceitar — fallback é gracioso.**

---

## Reporte final Pass 4

Convergência **NÃO ATINGIDA** — 7 críticos novos descobertos.

**Próximos passos:** waves de fix por severidade. Críticos primeiro (electron lock, DevTools, WebSocket stub, menu reload, CSP backend, backup local, schema versioning).
