# Electron Audit Pass 5

Quinta passada. Branch `claude/brave-beaver-6c804d`.

Pass 4 entregou 7 críticos + 10 altos + 10 médios + 7 baixos = **34 itens** (28 fixados, 6 aceitos como roadmap). Pass 5 cobre:

1. Verificação dos fixes do Pass 4
2. 13 ângulos novos solicitados (electron-updater, safeStorage, stubs, concurrent edits, schema drift, INSTALL, LGPD, code quality...)

---

## Verificação Pass 4

| Item | Fix esperado | Verificação | Status |
|---|---|---|---|
| P4-C1 Electron lockfile regen | Electron 33+ no lockfile | `package.json:86` declara `^40.10.0`. `package-lock.json:13` confirma `"electron": "^40.10.0"`. `npm audit` retorna `found 0 vulnerabilities`. | OK |
| P4-C2 DevTools bloqueado em prod | `before-input-event` + context-menu + devtools-opened | `electron/main.js:320-352` implementado. F12, Ctrl+Shift+I/J/C, Cmd+Opt+I/J, Ctrl+R, Ctrl+Shift+R todos bloqueados. context-menu preventDefault. devtools-opened → closeDevTools. | OK |
| P4-C3 WebSocket noop em Electron | `WS_AVAILABLE = !isFileProtocol` | `frontend/src/hooks/useWebSocket.js:23-26` detecta `file:` protocol e retorna `if (!WS_AVAILABLE) return;`. | OK |
| P4-C4 Menu Visualizar sem reload em prod | submenu condicional `isDev || !app.isPackaged` | `electron/main.js:467-469` confirma. | OK |
| P4-C5 CSP backend sem wildcard onrender | `connectSrc: ["'self'", 'http://127.0.0.1:*']` | `backend/src/server.js:43` confirmado. `frameAncestors: ["'none'"]` adicionado (P4-M1). | OK |
| P4-C6 Backup local implementado | rota POST `/api/backup/create`, GET `/local`, POST `/restore/:filename` | `backend/src/routes/backup.js:56-113` completo. Backup auto pré-restore. UI `frontend/src/pages/Backup.jsx` integrada. | OK |
| P4-C7 Schema versioning | `schema_versions` + `runPendingMigrations` | `backend/src/config/initDb.js:194-198`, `runPendingMigrations:275-328`. Backup pré-migration em `local.db.pre-migration-NNN`. | OK |
| P4-A1 dexie removida | sem dexie em deps | `frontend/package.json` confirmado: sem `dexie`. `App.jsx:12` comentário menciona remoção. **MAS** `frontend/node_modules/dexie/` AINDA EXISTE em disco (não rodaram `npm install` no worktree). Em produção, o bundle Vite não inclui sem import — sem impacto runtime. | OK (com nota) |
| P4-A2 crashDumps retention | `purgeOldCrashDumps()` >30 dias | `main.js:520-537` implementado. Chamado em deferido 5s após whenReady (linha 545-548). | OK |
| P4-A3 context menu bloqueado | `webContents.on('context-menu', preventDefault)` | `main.js:347` confirmado, dentro do guard `if (!isDev && app.isPackaged)`. | OK |
| P4-A4 Register.jsx removida | sem `/register` em App.jsx | `App.jsx:106` comentário documenta. Sem rota. **MAS** arquivos `frontend/src/pages/Register.jsx` e `ResetPassword.jsx` não foram deletados do disco — só descabeçados nas rotas. Dead code on-disk. Aceito como cosmético. | PARCIAL |
| P4-A5 safeStorage | encriptar secrets.json via DPAPI/Keychain | **NÃO IMPLEMENTADO.** Não há referência a `safeStorage` em todo o código de produção. Roadmap honrado mas item P5 ainda pendente. | NÃO APLICADO |
| P4-A6 sync-config safeStorage | mesma proteção | Idem P4-A5. | NÃO APLICADO |
| P4-A7 bootstrap re-check sem filtro ativo | COUNT(*) sem WHERE ativo | `routes/auth.js:38, 72` confirmados (`SELECT COUNT(*) as n FROM usuarios`). | OK |
| P4-A8 validateId fechado | Number.parseInt + String(parsed)===String(id) | `middleware/validateId.js` mantido — testes em `tests/validateId.test.js` cobrem 7 casos. | OK |
| P4-A9 logs sem CPF | logger só URL/status/dt | `server.js:97-108` confirmado, body nunca logado. | OK |
| P4-A10 stubs 501 UI | banner stub:true | `server.js:128-143` injeta `stub: true` em GET. **MAS** o frontend (telas Comissoes, Fechamento, Despesas, etc.) NÃO LÊ esse flag — continuam mostrando "lista vazia" sem banner. Backend feito, frontend incompleto. | PARCIAL |
| P4-M1 frame-ancestors none | helmet directive | `server.js:45` confirmado. | OK |
| P4-M2 webPreferences defensive | enableRemoteModule:false, navigateOnDragDrop:false | `main.js:301-302` confirmado. **MAS** `webgl: false` (sugerido) não foi adicionado. Defensive only — sem impacto. Aceito. | OK |
| P4-M3 --no-sandbox bloqueado | check argv + abort | `main.js:500-516` implementado: bloqueia `--no-sandbox`, `--disable-web-security`, `--allow-running-insecure-content`. | OK |
| P4-M4 backup pré-migrate | local.db.pre-migration-NNN | `initDb.js:301-313` implementado. | OK |
| P4-M5 _pendingFingerprint disconnect | reset em disconnect | `syncService.js:351` confirmado (`this._pendingFingerprint = null`). | OK |
| P4-M6 stub flag na resposta GET | `stub: true` | `server.js:138` confirmado. UI usage = PARCIAL (ver P4-A10). | OK (backend) |
| P4-M7 webRequest font allow | exception para `resourceType === 'font'` | `main.js:567` confirmado. | OK |
| P4-M8 cors origin null | `!origin` permite | `server.js:83` confirmado. | OK |
| P4-M9 ACL local.db Windows | doc'd como aceito | Sem ação — aceito. | OK |
| P4-M10 crashReporter pre-ready | try/catch wrap | `main.js:31-33` confirmado. | OK |

**Resumo verificação:** 22/27 confirmados OK, 1 parcial (P4-A4 dead code on-disk), 2 parciais (P4-A10/M6 stub UI flag não consumido), 2 não aplicados (P4-A5/A6 safeStorage — roadmap).

---

## CRITICOS

### [P5-C1] safeStorage Electron ainda não implementado — JWT secret + sync token plaintext em disco

**Arquivos:** `SoftHair/electron/main.js:82-125`, `SoftHair/backend/src/lib/secrets.js`, `SoftHair/backend/src/services/syncService.js:123-185`

**Descrição:** Pass 4 P4-A5 e P4-A6 marcaram safeStorage como roadmap. **Pass 5 reabre** porque sem isso:

1. **`secrets.json`** (contém `jwtSecret`) está em `%APPDATA%\SoftHair\database\secrets.json` em plaintext com chmod 0o600 (Windows ignora). Qualquer processo do mesmo user lê. Malware em escopo do user (já dentro), Win+R drives mapeados, OneDrive sync acidental — exfil é trivial.

2. **`sync-config.json`** (contém `token` encriptado AES-256-GCM mas com **chave derivada do JWT_SECRET**). Se o atacante tem `secrets.json` (item 1), tem a chave de criptografia do sync-config. Encrypted-at-rest virtua plain.

3. **DPAPI (Windows) / Keychain (macOS) / libsecret (Linux)** via `electron.safeStorage` resolve: a chave é vinculada ao user account + machine. Malware em outro user ou em outra máquina não decripta.

**Exploit cenário:**
- Cliente do salão consegue acesso físico ao PC por 30s.
- Cola pendrive com script que copia `%APPDATA%\SoftHair\database\` inteiro.
- Em casa, com Node instalado, lê `secrets.json` → tem JWT_SECRET → gera JWT falso para o servidor Render → impersona o salão.
- Bonus: lê `sync-config.json`, com `secrets.json` derive a chave AES, decripta o token cloud → acesso direto ao Render API.

**Fix:** Implementar pipeline opcional safeStorage no main.js antes do fork do backend:

```js
const { safeStorage } = require('electron');
function migrateSecretsToSafeStorage(dataDir) {
  if (!safeStorage.isEncryptionAvailable()) return; // headless/CI/wayland sem keyring
  const secretsFile = path.join(dataDir, 'secrets.json');
  if (!fs.existsSync(secretsFile)) return;
  const raw = fs.readFileSync(secretsFile, 'utf-8');
  let parsed; try { parsed = JSON.parse(raw); } catch { return; }
  if (parsed.encryptedJwtSecret) {
    // já migrado; decripta para o env
    const dec = safeStorage.decryptString(Buffer.from(parsed.encryptedJwtSecret, 'base64'));
    process.env.JWT_SECRET = dec;
    return;
  }
  // primeira execução pós-migration: criptografa e regrava
  if (parsed.jwtSecret) {
    const enc = safeStorage.encryptString(parsed.jwtSecret).toString('base64');
    const newPayload = { encryptedJwtSecret: enc, migratedAt: new Date().toISOString() };
    fs.writeFileSync(secretsFile, JSON.stringify(newPayload, null, 2), { mode: 0o600 });
    process.env.JWT_SECRET = parsed.jwtSecret;
  }
}
```

Aplicar análogo para `sync-config.json` (criptografar `token` com safeStorage diretamente, não via chave derivada).

**Severidade**: Crítico porque mitiga ataque físico + multi-tenant Windows + sync acidental para nuvem (OneDrive).

### [P5-C2] electron-updater ausente — sem auto-update + sem signed releases

**Arquivos:** `SoftHair/package.json` (sem `electron-updater` em deps), `SoftHair/electron/main.js` (sem autoUpdater)

**Descrição:** `electron-updater` não está instalado. Não há `autoUpdater.checkForUpdatesAndNotify()` no main process. Não há `electron-builder` `publish` config. **Consequências:**

1. **Usuário fica em versão fixa pra sempre.** Quando crítico CVE Electron aparece (vide histórico Pass 3 P3-A6 = 8 advisories), salão fica vulnerável até alguém manualmente baixar release nova e reinstalar. Salões pequenos quase nunca fazem isso.

2. **Sem verificação de assinatura.** Mesmo se update for distribuído, sem code signing + electron-updater, atacante MitM pode injetar binary maligno. Hoje, instalador NSIS nem é assinado (não há `signtool` config em `package.json.build`).

3. **Sem channel de release.** GitHub Releases ou servidor próprio é roadmap zero. Para distribuir hoje, link manual.

**Pass 5 exigia implementar.** Como o app é freshly desktop sem release pipeline, Pass 5 entrega:
- electron-updater instalado e configurado em main.js
- `publish: { provider: 'github', owner: 'guijoioj', repo: 'SoftHair' }` em `package.json.build`
- checkForUpdatesAndNotify() chamado no `app.whenReady()` em prod
- update-downloaded handler com dialog não-intrusivo (botão "Reiniciar agora" / "Depois")
- code signing fica fora do escopo (requer cert pago + máquina Windows), mas docs em INSTALL.md

**Severidade:** Crítico. Sem update path, todo CVE Electron futuro vira incidente parado.

### [P5-C3] Stubs 501 frontend não lê `stub: true` flag — UI continua hostil

**Arquivos:** `SoftHair/frontend/src/pages/Comissoes.jsx`, `Fechamento.jsx`, `Despesas.jsx`, `Financeiro.jsx`, `Metas.jsx`, `Notificacoes.jsx`, `Relatorios.jsx`, `Administrativo.jsx`, `Caixa.jsx`

**Descrição:** Pass 4 P4-M6 backend retorna `{ success: true, data: [], stub: true, message: "..." }` mas o frontend de TODAS as 9 telas ignora `stub`. Renderiza "Nenhum registro" em vez de "Funcionalidade em desenvolvimento".

**Verificação:**
```bash
grep -rn "stub" frontend/src/pages/  # zero matches
```

Logo, user vê tela vazia, pensa "tudo zero", marca como bug ("contabilidade quebrada"), gera ticket de suporte. Pass 4 entregou metade — falta consumir.

**Fix Pass 5:** ou (a) criar componente `<StubBanner message={...} />` reusado nas 9 telas que detecte `data?.stub === true` na primeira query, ou (b) adicionar interceptor em `services/api.js` que injete um banner global quando qualquer GET retorna stub:true. (a) é menos invasivo.

**Severidade:** Crítico para UX. Bug experiencial — confiança do user erode rápido em "feature parece existir mas não funciona".

### [P5-C4] Concurrent edits — sem conflict resolution, last-write-wins silencioso

**Arquivos:** `SoftHair/backend/src/services/syncService.js:583-619` (upsertRow), backend cloud (Render)

**Descrição:** Cenário descrito no escopo:
1. PC A edita cliente X às 10:00:00 (sync OFF, salva local)
2. PC B edita cliente X às 10:00:01 (sync OFF, salva local)
3. Ambos PCs ligam sync.
4. PC A push → cloud aceita, updated_at=10:00:00.
5. PC B push → cloud aceita, updated_at=10:00:01.
6. PC A pull → recebe versão de PC B, **sobrescreve sem aviso**.
7. PC A não vê notificação de conflito. Mudança de PC A perdida silenciosamente.

`upsertRow` é INSERT ON CONFLICT(id) DO UPDATE — last-write-wins puro. Não há `WHERE updated_at < ?` para impedir downgrade. Não há tabela `sync_conflicts` para review humana.

**Cenários reais que disparam:**
- Salão com 2 funcionários compartilhando 1 PC + tablet pessoal de cada (futuro mobile sync).
- 2 instalações do desktop (raro mas existe em redes Wi-Fi de salão).
- Edit local quando offline + edit cloud paralelo via mobile app cliente.

**Fix Pass 5:** Implementar primeira camada de resolução:
1. `upsertRow` compara `updated_at` antes de sobrescrever. Se row local é mais recente, NÃO aplica, e registra em `sync_conflicts` table.
2. Endpoint `/api/sync/conflicts` lista pendentes.
3. UI nova `Sync.jsx` mostra contador "3 conflitos pendentes" com flow de revisão.

Para Pass 5 imediato, item 1+2 são suficientes (banco mantém histórico, UI vem depois — risco silencioso fica documentado mas detectável).

**Severidade:** Crítico para correctness. Dados perdidos sem aviso = compliance LGPD broken (não pode dizer "guardamos histórico").

---

## ALTOS

### [P5-A1] Stubs 501 ainda em 6 rotas — Comissoes/Fechamentos/Despesas/Financeiro/Metas requerem backend novo

**Arquivos:** `SoftHair/backend/src/server.js:128-144`

**Descrição:** Stubs ativos `notificacoes / fechamentos / comissoes / creditos / historico / saloes`. Implementar pelo menos:

1. **Comissões**: calculadas como soma de `atendimentos.valor * profissionais.comissao_percentual` por período. Simples agregação SQL.
2. **Fechamentos**: snapshot diário/mensal de vendas + atendimentos + despesas. Tabela `fechamentos` com `data_inicio`, `data_fim`, `totalReceita`, `totalDespesa`, `lucroLiquido`, `fechado` (flag).
3. **Despesas**: tabela `despesas (id, salao_id, descricao, valor, data, categoria)`. CRUD trivial.
4. **Financeiro**: agrega `vendas + despesas`. Stub agora.
5. **Metas**: tabela `metas (id, salao_id, periodo, tipo, valor, atingida)`.

Pass 5 implementa COMISSÕES e DESPESAS (mais comuns, mais críticos para gestão do salão). Fechamentos, Financeiro, Metas continuam stub com banner UI (P5-C3 fix cobre).

**Severidade:** Alta — features core do produto desktop sem nuvem.

### [P5-A2] `/api/auth/me/delete-data` (LGPD) ausente no backend embarcado

**Arquivos:** `SoftHair/backend/src/routes/auth.js` (sem endpoint delete-data)

**Descrição:** LGPD art. 18 — titular dos dados pode requerer exclusão. App roda 100% local, mas o user (admin do salão) precisa de path para purge total dos dados ANTES de desinstalar/transferir o PC. Sem endpoint, opção é "deletar pasta userData/SoftHair manualmente" — inseguro porque deixa partes em logs, crash dumps, OneDrive sync.

**Fix:** Endpoint `POST /api/auth/me/delete-account-data` (autenticado, com confirmação por re-senha):
1. Re-valida senha do user.
2. DROP TABLE all data tables (cliente, profissional, etc) e recria vazios.
3. Apaga `secrets.json` (regenera no próximo start = força re-bootstrap).
4. Apaga `sync-config.json`.
5. Apaga `logs/` e `backups/`.
6. Tenta apagar `crashDumps/`.
7. Responde 200 com flag `restart_required: true`.
8. Electron escuta IPC `auth:data-deleted` → reinicia.

UI dedicada em Configuracoes.jsx — botão vermelho "Apagar todos os dados deste salão (irreversível)".

**Severidade:** Alta para compliance LGPD. Sem isso, recurso de "esquecimento" não é entregável.

### [P5-A3] WebSocket no backend embarcado — implementar minimal ou documentar removal definitivo

**Arquivos:** `SoftHair/backend/src/server.js`, `SoftHair/frontend/src/hooks/useWebSocket.js`

**Descrição:** Pass 4 P4-C3 stubeou o hook como noop quando `file://`. **Mas** a UI tem múltiplos pontos que esperam tempo real:
- `Agenda.jsx:317-318` — notificação de novo agendamento.
- `Layout.jsx:33,95` — sino de notificações.
- Solicitacoes.jsx — solicitações de agendamento de clientes (via mobile).

Sem WS, esses dependem de polling (que não existe) ou refresh manual. Em desktop standalone (sem cloud sync ativo), não há "tempo real" possível porque não há outra fonte de eventos — apenas eventos próprios do user. Aceitar como design. Em desktop com cloud sync, a versão cloud no Render serve o WS.

**Fix Pass 5:** **Documentar permanentemente** que o hook é no-op em Electron via comentário e adicionar polling alternativo opcional:
- Quando `isFileProtocol`, em vez de WS, usar polling 30s em rotas que importam (apenas se feature flag `usePollingFallback`).
- Implementar polling não é prioridade Pass 5 — apenas adicionar comentário consolidado e remover do roadmap.

**Severidade:** Alta para clareza arquitetural. Não implementar WS local foi decisão Pass 4 — Pass 5 ratifica.

### [P5-A4] Schema drift entre SQLite local e PostgreSQL Render — sync ignora campos PostgreSQL-only

**Arquivos:** `SoftHair/backend/src/services/syncService.js:48-83` (TABLE_COLUMNS), `SOFT-HAIR-SERVER/migrate.js`

**Descrição:** SQLite local define schema em `initDb.js`. Server cloud (SOFT-HAIR-SERVER) usa `migrate.js` com migrations PostgreSQL. **Diferenças identificadas:**

| Campo | SQLite local | Postgres cloud |
|---|---|---|
| `clientes.foto_url` | TEXT | TEXT — sync OK |
| `clientes.created_at` | TEXT ISO via strftime | TIMESTAMPTZ DEFAULT NOW() — sync via JSON serialize ok |
| `profissionais.app_ativo` | INTEGER 0/1 | BOOLEAN — sync intencionalmente OMITIDO (TABLE_COLUMNS) |
| `profissionais.senha_hash` | TEXT (nullable) | TEXT — sync intencionalmente OMITIDO |
| `agendamentos.cancelled_by_user_id` | (não existe) | INTEGER (Render adicionou em migration recente) | mismatch — push falha 400, pull tenta inserir e SQLite rejeita coluna inexistente |
| `vendas.valor_credito_usado` | (não existe) | REAL | mesma issue |
| Tabela `notificacoes`, `comissoes`, `fechamentos`, `despesas`, `creditos`, `historico` | (não existem em SQLite) | existe no Postgres | sync ignora silenciosamente (não em SYNC_TABLES) |

**Pass 5 cobre:**

1. Lista canonical das diferenças (este audit).
2. Adicionar `clientes.foto_url` e similar campos comuns ao SYNC_TABLES (verificar que estão).
3. Documentar oficialmente em `SoftHair/docs/sync-schema-drift.md`.

**Não cobre:** harmonizar schemas reais (exige coordenação com SOFT-HAIR-SERVER + migrations multi-side). Aceitar como dívida documentada.

**Severidade:** Alta. Sync silencioso descarta dados — sem alerta para user.

### [P5-A5] Funções > 100 linhas — code quality alvo de refactor

**Arquivos:** `backend/src/services/syncService.js` (637 linhas, classe inteira), `backend/src/config/initDb.js:17-262` (initDb 246 linhas), `electron/main.js:284-485` (createWindow 201 linhas), `electron/main.js` total 609 linhas

**Descrição:** Funções monolíticas dificultam test coverage e mudanças focadas. Limites razoáveis:
- `createWindow` → splitar em `setupWebPreferences`, `attachInputGuards`, `installMenu`, `loadIndex`.
- `initDb` → splitar `applySchema`, `seedSalao`, `seedAdmin`, `applyMigrations`.
- `SyncService._doSync` (linhas 447-503) tem 56 linhas, ok.
- `SyncService.applyRemoteChanges` (542-579) tem 37 linhas, ok.
- `SyncService.getLocalSalaoId` (217-272) tem 55 linhas — limite aceitável.

**Fix Pass 5:** split de `createWindow` e `initDb` em funções menores. Sem mudança de comportamento — apenas estrutura.

**Severidade:** Alta para manutenção a longo prazo. Aceitar como roadmap se complexidade do refactor > benefício imediato.

### [P5-A6] Erros silenciosos em `withTransaction` SQLite — async-trap detection imperfeita

**Arquivos:** `SoftHair/backend/src/config/database.js:181-220`

**Descrição:** Já documentado P3-C3 (Pass 3): better-sqlite3 é síncrono; se callback faz `await` real (axios, fs.promises), COMMIT acontece antes do await terminar. P3 fix detecta Promise mas confessa que se await já executou, commit foi feito.

**Reabrir em P5:** o fix Pass 3 é heurística — não previne, apenas detecta. Solução robusta:
- (a) Recusar callbacks async-syntax em `withTransaction` SQLite. Throw em runtime se `fn.constructor.name === 'AsyncFunction'`.
- (b) Documentar contrato claro: "callback DEVE ser síncrono — uso de fs.promises/axios proibido".

Fix Pass 5 implementa (a) — throw at register-time é caro mas seguro.

**Severidade:** Alta. Silent corruption de transações é categoria séria.

### [P5-A7] Backup automático nunca dispara — feature documentada não implementada

**Arquivos:** `SoftHair/backend/src/services/syncService.js` (sem cron de backup)

**Descrição:** Backup.jsx tem botão "Criar backup" manual. Mas backup AUTOMÁTICO diário (mencionado em Pass 4 P4-C6 fix roadmap) nunca foi implementado. Salão pode passar 6 meses sem rodar manual → SQLite corrompido → perda total.

**Fix Pass 5:** Cron simples (setInterval) no boot do backend que, se hora atual é entre 02:00-04:00 e último backup é >24h atrás, dispara `createBackup()`. Retention 7 dias. Adicionar `cleanupOldBackups` que mantém os 7 mais recentes.

**Severidade:** Alta — disaster recovery automático.

### [P5-A8] CORS rejeita silenciosamente `ALLOWED_ORIGINS` lista hardcoded — sem path para custom port

**Arquivos:** `SoftHair/backend/src/server.js:73-82`

**Descrição:** `ALLOWED_ORIGINS` é hardcoded para portas 3000/3001. Mas o Electron passa `PORT=3001` por env (`main.js:227`). Se user mudar a porta via env (raro mas suportado), CORS bloqueia frontend dev.

**Fix Pass 5:** Construir ALLOWED_ORIGINS dinamicamente lendo PORT do env. Permitir `http://localhost:${PORT}` e `http://127.0.0.1:${PORT}` sempre.

**Severidade:** Alta para dev workflow — desk standalone não afetado (sem dev mode em prod).

### [P5-A9] Sem `tests/integration/` para backend embarcado — apenas unit tests

**Arquivos:** `SoftHair/backend/tests/` (3 unit tests apenas)

**Descrição:** Tests cobrem `passwords.test.js`, `secrets.test.js`, `validateId.test.js` — todos unit. Sem teste de:
- POST /api/auth/login → flow completo (bootstrap admin → login → token).
- POST /api/sync/configure → mock cloud → sync iteration.
- POST /api/backup/create → assert arquivo gerado.
- migrations idempotência.

**Fix Pass 5:** adicionar `tests/integration/`:
- `auth.flow.test.js` — bootstrap + login + me.
- `backup.test.js` — create + list + restore (in-memory SQLite).
- `migrations.test.js` — schema_versions idempotente em re-run.
- `syncService.dryrun.test.js` — collectLocalChanges sem cloud real.

Para Pass 5 imediato: implementar `auth.flow` e `backup` (mais críticos).

**Severidade:** Alta. Tests integration cobrem regression que unit não pega.

### [P5-A10] `disconnect()` sync race — interval pode disparar entre clearInterval e logout

**Arquivos:** `SoftHair/backend/src/services/syncService.js:343-373`

**Descrição:** Race window estreita: `disconnect()` chama `this.stop()` que faz `clearInterval(this.interval)`. Mas se um sync já está em progresso (`this.syncPromise`), `disconnect()` zera `this.token = null` enquanto axios call ainda roda. Cenário:
1. T=0: interval dispara, `_doSync` começa, axios POST em flight, Authorization: Bearer ${old_token}.
2. T=200ms: user clica "Disconnect", `disconnect()` chama `this.token = null`, `unlinkSync(CONFIG_FILE)`.
3. T=300ms: axios call do passo 1 termina, `this.saveConfig()` é chamado (linha 481) que regrava `sync-config.json` com `token: null` mas re-cria o arquivo.

Resultado: arquivo `sync-config.json` aparece novamente em disco com `{}` em vez de deletado. P3-M3 truncate fallback não pega.

**Fix Pass 5:** `disconnect()` deve await `this.syncPromise` antes de zerar fields. Adicionar `this._disconnecting = true` flag e `_doSync` checa antes de saveConfig.

**Severidade:** Alta para correctness — credenciais residuais em disco contradiz garantia.

---

## MEDIOS

### [P5-M1] `Login.jsx` e telas de auth não tratam `429 Too Many Requests` do rate-limiter

**Arquivos:** `SoftHair/frontend/src/pages/Login.jsx`

**Descrição:** Backend retorna 429 com `{ success: false, error: 'Muitas tentativas. Tente novamente em 15 minutos.' }` (auth.js:17). Frontend trata como erro genérico — mostra a mensagem mas sem disable do form (user pode martelar). Idealmente disable+countdown.

**Fix Pass 5:** No catch do submit, se `error.response?.status === 429`, set state `lockedUntil = Date.now() + 15*60*1000` e renderizar contador.

**Severidade:** Médio UX.

### [P5-M2] Backup.jsx não permite download do arquivo para PC externo

**Arquivos:** `SoftHair/frontend/src/pages/Backup.jsx`

**Descrição:** Lista os backups e permite restore, mas não permite download/export. User precisa abrir `userData/SoftHair/database/backups/` manualmente no Explorer para copiar. Não há botão "Exportar" que use `electron.showSaveDialog` + copy.

**Fix Pass 5:** Endpoint `GET /api/backup/download/:filename` (autenticado) que faz `res.download(...)` + UI button.

**Severidade:** Médio UX. Sem isso, "backup off-PC" é workflow manual.

### [P5-M3] `crashDumps` purge corre antes do user ver

**Arquivos:** `SoftHair/electron/main.js:520-537, 545-548`

**Descrição:** `purgeOldCrashDumps()` chamado 5s após `whenReady`, retention 30 dias. **Mas** dumps recentes (< 30 dias) ficam acumulados sem aviso. Se o app crashea com frequência, dumps de 50-500MB cada acumulam em GB nos primeiros 30 dias.

**Fix Pass 5:** Após retention, manter no máximo 5 dumps mais recentes (sort by mtime desc, delete o resto). Adicionar log `[Electron] N crash dumps mantidos`.

**Severidade:** Médio espaço em disco.

### [P5-M4] Sync passa filterless `updated_at > since` — pode incluir rows que foram criadas pela própria pull do sync (loop)

**Arquivos:** `SoftHair/backend/src/services/syncService.js:510-534` (collectLocalChanges)

**Descrição:** Após `applyRemoteChanges` aplicar updates, esses updates ficam com `updated_at = now`. Próxima iteração de sync, `collectLocalChanges` lê esses mesmos rows (updated_at > since) e os manda de volta para cloud como UPDATE. Cloud ignora (ON CONFLICT DO UPDATE com mesma data) mas custa bandwidth + tempo.

**Fix Pass 5:** Adicionar coluna `synced_from_remote_at` em tabelas sync OR usar dirty flag (`sync_log`). Para imediato, usar `updated_at > lastSync AND updated_at > created_at` heuristic com check de "fonte" via timestamp. Pulo: adicionar in-memory set `recentlyPulledIds` que ignora collect dessas ids por 1 ciclo.

**Severidade:** Médio performance. Visível em syncs frequentes.

### [P5-M5] `frontend/src/services/api.js` interceptor não desloga em 401

**Arquivos:** `SoftHair/frontend/src/services/api.js`

**Descrição:** Pass 1-4 nunca tocou no interceptor. Se backend retorna 401 (token expirado), axios resposta passa silenciosa. UI não desloga, queries re-tentam indefinidamente.

**Fix Pass 5:** No axios response interceptor:
```js
response => response,
error => {
  if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
    tokenStorage.clear();
    window.location.href = '/login';
  }
  return Promise.reject(error);
}
```

**Severidade:** Médio UX.

### [P5-M6] Backend embarcado não fecha SQLite handle em crash do app

**Arquivos:** `SoftHair/electron/main.js:586-609` (window-all-closed + before-quit), `SoftHair/backend/src/server.js:177-193`

**Descrição:** Em close normal, `app.on('before-quit')` SIGTERMs backend, backend handle SIGTERM faz `server.close()` + fecha SQLite. **Mas** se Electron crasha (uncaughtException no main), `before-quit` não dispara, backend recebe SIGKILL via `process.kill('SIGKILL')` que skip cleanup. SQLite WAL pode ficar com `.wal` pendente.

**Fix Pass 5:** Em `uncaughtException` (main.js:488-491), antes de log, tentar SIGTERM no backend ANTES do SIGKILL no setTimeout. Aumentar timeout SIGKILL de 2s para 5s para dar tempo do checkpoint WAL.

**Severidade:** Médio data integrity.

### [P5-M7] `sync-config.json` salvo mesmo quando enabled=false

**Arquivos:** `SoftHair/backend/src/services/syncService.js:292-308`

**Descrição:** `saveConfig` regrava o arquivo sempre. Se user nunca configurou sync, mas chamou `getStatus`, o arquivo é criado vazio. Aceitar — não vaza nada. Mas espelha lixo em disco.

**Fix Pass 5:** `saveConfig` early-return se `!cloudUrl && !token`.

**Severidade:** Baixo. Reclassificar para B.

### [P5-M8] Frontend tokenStorage falback localStorage abre porta XSS

**Arquivos:** `SoftHair/frontend/src/services/tokenStorage.js`

**Descrição:** Pass 2 já tratou (P2-A4: in-memory primary, localStorage fallback). MAS em Electron file://, localStorage continua acessível via DevTools (que P4-C2 fix bloqueia em prod, mas dev/build manual). Aceito como dev-only risk.

**Aceitar.**

### [P5-M9] `WebRequest` filter em main.js não bloqueia data: URI grande (DoS via memory)

**Arquivos:** `SoftHair/electron/main.js:553-572`

**Descrição:** Filter permite `data:` URIs (linha 562). Atacante via XSS (já dentro) pode criar `<img src="data:image/png;base64,${very_long}">` consumindo memória. Não é exploit comum mas defesa.

**Fix Pass 5 sugerido:** Adicionar size hint check — não trivial via webRequest. Aceitar.

### [P5-M10] `crashReporter.start` no boot mas pode ser called twice se app rebooting via `app.relaunch`

**Arquivos:** `SoftHair/electron/main.js:31-33`

**Descrição:** Não problema atual. Apenas defensive.

**Aceitar.**

---

## BAIXOS

### [P5-B1] `package.json` `private` field não declarado — npm install warning

**Arquivos:** `SoftHair/package.json`

**Descrição:** Mantém license MIT mas o app não vai pra npm publish. Adicionar `"private": true` evita publish acidental.

**Fix:** trivial.

### [P5-B2] `electron-builder` config sem `forceCodeSigning` — releases sem assinatura passam

**Arquivos:** `SoftHair/package.json:23-80`

**Descrição:** Roadmap junto com P5-C2 (electron-updater).

### [P5-B3] INSTALL.md não menciona safeStorage migration

**Arquivos:** `SoftHair/INSTALL.md`

**Descrição:** Atualizar após P5-C1 fix.

### [P5-B4] Logs em `userData/logs/` não comprimem `.old`

**Arquivos:** `SoftHair/electron/main.js:172-178`

**Descrição:** Rotação por size renomeia `.old`. Sem gzip. 10MB × N arquivos pode crescer.

**Fix:** zlib.gzipSync no rotate. Trivial mas adia.

### [P5-B5] `frontend/src/pages/Register.jsx` e `ResetPassword.jsx` ainda no disco

**Arquivos:** `SoftHair/frontend/src/pages/Register.jsx`, `ResetPassword.jsx`

**Descrição:** P4-A4 removeu rotas, não arquivos. Dead code. Pass 5 deleta.

### [P5-B6] `SECURITY.md` não menciona safeStorage requirement em > Pass 5

**Arquivos:** `SoftHair/SECURITY.md`

**Descrição:** Atualizar após P5-C1.

### [P5-B7] `package-lock.json` electron-builder na versão 26 — bom, mas seguir upgrades

**Arquivos:** `SoftHair/package-lock.json`

**Descrição:** Ativo. `npm audit` retorna 0 vulnerabilities. Aceitar.

---

## Resumo

**Novos issues Pass 5:**

| Severidade | Count | IDs |
|---|---|---|
| Críticos | 4 | P5-C1 a P5-C4 |
| Altos | 10 | P5-A1 a P5-A10 |
| Médios | 10 | P5-M1 a P5-M10 |
| Baixos | 7 | P5-B1 a P5-B7 |
| **Total** | **31** | |

**Verificação Pass 4:** 22/27 fixes confirmados OK; 1 parcial (P4-A4 arquivos ainda em disco — dead code); 2 parciais (P4-A10/M6 stub UI flag não consumido); 2 NÃO aplicados (P4-A5/A6 safeStorage — escalados em P5-C1).

**Descobertas-chave:**

1. **safeStorage Electron ainda pendente** — P4-A5/A6 escalados para P5-C1 como crítico. Sem isso, JWT secret + sync token vulneráveis a malware mesmo-user e exfil via OneDrive accidental.

2. **electron-updater ausente** — sem auto-update + sem signed releases (P5-C2). CVE Electron futuro = incidente parado.

3. **Stubs 501 frontend não usa `stub: true`** — Pass 4 metade. Banner não aparece. 9 telas hostis (P5-C3).

4. **Concurrent edits last-write-wins** — sem detecção, sem `sync_conflicts` table, dados perdidos silenciosos (P5-C4).

5. **LGPD delete-data endpoint ausente** (P5-A2).

6. **Schema drift documentado** com tabela canonical (P5-A4).

7. **Backup automático nunca dispara** — só manual (P5-A7).

8. **Sem tests integration** — apenas 3 unit tests (P5-A9).

9. **disconnect() race** — credenciais residuais em disco (P5-A10).

10. **createWindow/initDb funções gigantes** — code quality (P5-A5).

**Áreas verificadas limpas após Pass 4:**
- Electron lockfile (P4-C1) — upgrade aplicado, 0 advisories.
- DevTools/Ctrl+R bloqueados (P4-C2/C4) — implementação correta.
- WebSocket noop em Electron (P4-C3) — bypass correto.
- CSP backend sem onrender wildcard (P4-C5) — strict.
- frame-ancestors none (P4-M1) — implementado.
- Backup local funcional (P4-C6) — backend + UI.
- Schema versioning + backup pre-migration (P4-C7).
- Webrequest filter + font allow (P3-A4/P4-M7).
- crashReporter retention + dumps (P4-A2) — implementado.
- context menu blocked (P4-A3).
- --no-sandbox abort (P4-M3).
- Bootstrap re-check sem filtro ativo (P4-A7).

**LGPD status:**
- Logs locais redactam token/senha (verificado).
- Body de POST nunca logado.
- Backup local manual disponível.
- delete-data endpoint AUSENTE (P5-A2 — fixar).
- Crash dumps ficam locais (não enviam para Google) — OK.

**Auto-update status:**
- electron-updater AUSENTE (P5-C2).
- Sem GitHub Releases configurado.
- Sem code signing.
- User precisa baixar release manualmente.

**Telemetria:**
- crashReporter.uploadToServer:false — verificado.
- Sem analytics, sem ping de uso.
- Spellcheck desabilitado.
- Sem outbound não-consentido.

**Code quality:**
- electron/main.js 609 linhas — split em sub-funções recomendado.
- backend/src/services/syncService.js 637 linhas — aceitar (classe single-responsibility).
- backend/src/config/initDb.js 330 linhas — split em applySchema/seedSalao/seedAdmin/migrations.
- Funções > 100 linhas: createWindow (201), initDb (245), buildAxiosConfig (~30, ok), withTransaction (~40, ok).
- Catches sem log: P5 lista 14 catches `catch (_)` em 4 arquivos, mas 13 deles são intencionais (Windows chmod, cleanup, JWT parse — comportamento esperado).
- `setInterval(..., 30000)` em syncService.js:379 com `.catch(() => {})` swallow legitimate (não há UI para report). Documentado.

**Tests status:**
```
backend/tests:
  passwords.test.js — 7 asserts OK
  secrets.test.js — 6 asserts OK
  validateId.test.js — 7 asserts OK
Total: 3 test files, 0 failed. 20 asserts.
```

**Dependências:**
- `npm audit` em SoftHair root: 0 vulnerabilities (Electron 40, electron-builder 26, lockfile sincronizado).
- backend embarcado: dependências stable, sem dev em produção (via npm prune --production no build).
- frontend: dexie REMOVIDA das deps. Bundle Vite limpo.

**Stubs ativos (P5-A1 implementa parcial):**
- `/api/notificacoes` — count stub, lista stub.
- `/api/fechamentos` — STUB.
- `/api/comissoes` — STUB (será implementado em P5).
- `/api/creditos` — STUB.
- `/api/historico` — STUB.
- `/api/saloes` — me retorna fake, resto STUB.

**Schema drift documentado:**
- `app_ativo` / `senha_hash` propositalmente OMITIDOS de sync.
- `cancelled_by_user_id` (postgres-only) — push falha silenciosa.
- `valor_credito_usado` (postgres-only) — push falha silenciosa.
- Tabelas `notificacoes/comissoes/fechamentos/despesas/creditos/historico` no postgres não existem em SQLite local.

---

## Reporte final Pass 5

Convergência **NÃO ATINGIDA** — 4 críticos novos + 10 altos novos descobertos.

Críticos têm fix concreto pronto. Próximas waves: implementar críticos, depois altos, depois médios. Baixos podem aguardar Pass 6.
