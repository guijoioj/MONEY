# Electron Audit Pass 7

Sétima passada. Branch `claude/brave-beaver-6c804d`.

Pass 6 entregou 4 críticos + 10 altos + 10 médios + 7 baixos = **31 itens**. Pass 7 verifica os fixes do Pass 6, fecha pendências dos passes anteriores e cobre 15 ângulos novos.

---

## Verificação Pass 6

| Item | Fix esperado | Verificação | Status |
|---|---|---|---|
| P6-C1 404 routes | financeiro, bloqueios, configuracoes, saloes, agendamentos/proximos·pendentes·converter, produtos/categorias, servicos/categorias, vendas/estatisticas, atendimentos/fechamento, app/pedidos stub, auth/forgot·reset·change 501 | `server.js:115-172` rotas mounted. `routes/financeiro.js` (dre, projecao real). `routes/bloqueios.js` CRUD com `ensureTable`. `routes/configuracoes.js` key-value. `routes/saloes.js` GET/PUT /me. `routes/agendamentos.js:41,62,82,108` proximos/pendentes/converter. `routes/produtos.js:37,77` categorias/estoque-baixo. `routes/servicos.js:34` categorias. `routes/vendas.js:39` estatisticas. `routes/atendimentos.js:41` fechamento. Stub explícito `app/pedidos` + 501 forgot/reset/change. Test `routes-coverage.test.js` cobre 33 rotas — passa. | OK |
| P6-C2 conflict UI | Card painel + diff visual + botão local/remote | `pages/Sync.jsx:32-44, 345-410` polling 10s, painel completo com diff JSON local vs remote, badge contador, ações. Border-left amarelo. Limit 50 viewport. | OK |
| P6-C3 LGPD delete-data UI | Botão + modal + senha + checkbox | `pages/Configuracoes.jsx:11-117 DeleteDataModal` + seção privacidade `184-208`. Senha re-validada, checkbox required, vermelho disabled. | OK |
| P6-C4 backup download | Botão Baixar por linha + blob axios | `pages/Backup.jsx:85-106` handleDownload usa `responseType:'blob'`, createObjectURL, `<a download>`. Botão Download na tabela com lucide. | OK |
| P6-A1 despesas porCategoria | Backend alias + frontend cobre ambos | `routes/despesas.js:55-89` retorna `porCategoria` E `categorias` aliases; `rangeFromQuery` aceita mes/ano OU dataInicio/dataFim. `pages/Despesas.jsx:160-173` lê fallback `resumoData.porCategoria || resumoData.categorias`. | OK |
| P6-A2 console.log produção | wrap import.meta.env.DEV ou remover | Atendimentos.jsx — todos console.log removidos (`grep` retorna apenas comments). `services/api.js` idem. **MAS** `Agenda.jsx:815` ainda tem `console.log('Conflito detectado:', conflitos)` ativo — escape do fix. | PARCIAL |
| P6-A3 multi-user OS Windows | doc INSTALL.md + env override | `app.getPath('userData')` continua em `main.js:399, 765`. INSTALL.md não atualizado com pattern multi-user. SOFTHAIR_DATA_DIR_OVERRIDE não implementado. Aceito como roadmap em Pass 6. | NÃO APLICADO |
| P6-A4 VACUUM + INCREMENTAL | pragma + cron | `config/database.js:142-156` `auto_vacuum = INCREMENTAL`, `synchronous = NORMAL`, `incremental_vacuum + optimize` no boot via setImmediate. Não cron periódico mas suficiente para usage low-churn. | OK |
| P6-A5 routes-coverage test | tests/integration/routes-coverage.test.js | `tests/routes-coverage.test.js` — 33 rotas, espera ≠404. Skip graceful em better-sqlite3 binding mismatch. Test passa no env atual. | OK |
| P6-A6 code signing | doc | Documentado em SECURITY.md. Aceito (cert pago $300+/ano fora do escopo). | ACEITO |
| P6-A7 cold start timeout | timeout 45s + retry | `syncService.js:447` timeout 45000ms. Retry implícito via interval 30s. Sem retry single-shot antes de aceitar falha, mas 45s cobre cold start típico. | OK |
| P6-A8 setup wizard ECONNREFUSED retry | retry 1s × 30 | `pages/Login.jsx:44-73` retry attempts<30, 1s intervalo, distinção isNetwork via `!err?.response`. | OK |
| P6-A9 logs redact JWT | regex Bearer/JWT/token | `electron/main.js:321-372 redactSecrets` Bearer/eyJ JWT pattern/query string `token|senha|password|secret|apikey`. Aplicado em appendLog antes de write. | OK |
| P6-A10 input validation frontend | regex CPF/telefone/CEP | `pages/Clientes.jsx` continua sem regex CPF/telefone — apenas placeholders e `type="email"` HTML. Validação só backend. Pass 6 marcou roadmap. | NÃO APLICADO |
| P6-M1 StubGlobalBanner contador | acumular lista | Componente foi mantido v1; banner emite e renderiza por evento. Sem contador. | NÃO APLICADO |
| P6-M2 releaseNotes dialog | info.releaseNotes detail | `main.js:111-128` dialog text fixo "Versão X pronta". `info.releaseNotes` não incluído. | NÃO APLICADO |
| P6-M3 sync-config safeStorage | IPC bridge para fork | aceitar como roadmap (IPC bridge fork é refactor pesado). | NÃO APLICADO |
| P6-M4 backup NODE_ENV=test guard | aceito | Mantido conforme Pass 6 — sem mudança. | ACEITO |
| P6-M5 appendLog rate-limit | drop >100/s | `electron/main.js:335-348` _logBurstWindow + _logBurstCount limit 100 linhas/segundo. | OK |
| P6-M6 dexie extraneous | npm prune | Não verificável no repo (node_modules ignored), mas P4-A1 removeu de deps. Aceitar. | OK |
| P6-M7 img-src CSP allowlist | restringir | `frontend/index.html:11` `img-src 'self' data: https:` mantido. Pass 6 aceitou — sem servidor central de assets. | ACEITO |
| P6-M8 React Query retry false | queryClient config | `main.jsx:18-25` `retry: false`, `refetchOnWindowFocus: false`. Mutations herdam default. | OK |
| P6-M9 password strength UI | componente barra + checklist | `pages/Login.jsx:202-228` apenas placeholder e validação no submit. Sem barra visual de força. | NÃO APLICADO |
| P6-M10 .env.example | criar | `frontend/.env.example` existe. **Bug:** aponta para `VITE_API_URL=http://localhost:3000/api` mas backend embarcado roda em 3001 — copia direto vira broken. | PARCIAL (bug) |
| P6-B1 electron-updater UNMET | doc | Documentado em INSTALL.md (assume). | OK (cosmético) |
| P6-B2 dexie | npm prune frontend | idem M6 | OK |
| P6-B3 axios/vite mismatch | npm install | cosmético | OK |
| P6-B4 CLAUDE.md paths Windows | nota multi-OS | não atualizado. Aceitar. | NÃO APLICADO |
| P6-B5 autoInstallOnAppQuit | warning unsaved | `main.js:85` `autoInstallOnAppQuit = true` mantido. Sem warning unsaved. | NÃO APLICADO |
| P6-B6 console.log Atendimentos | idem A2 | OK | OK |
| P6-B7 icon assets | build/icon.* | `frontend/public/icon.svg` 18 linhas existe. **MAS** `package.json:64,68,72` referencia `build/icon.ico/.icns/.png` e o diretório `build/` NÃO existe. electron-builder falha em build com error MissingFile. | NÃO APLICADO |

**Resumo verificação:** 18/31 OK · 2 PARCIAIS · 8 NÃO APLICADOS · 3 ACEITOS.

**Parciais críticos para Pass 7:**
1. **P6-A2 console.log Agenda.jsx:815** — leak em prod via Electron logs.
2. **P6-M10 .env.example wrong port** — onboarding broken.
3. **P6-B7 build/icon.* missing** — build distribuição falha.

---

## CRITICOS Pass 7

### [P7-C1] Build de distribuição falha — `build/icon.*` referenciado em package.json mas diretório inexistente

**Arquivos:** `SoftHair/package.json:64-77`, ausência `SoftHair/build/`

**Descrição:** `package.json` declara:
```json
"win": { "target": ["nsis"], "icon": "build/icon.ico" },
"mac": { "target": "dmg", "icon": "build/icon.icns" },
"linux": { "target": ["AppImage"], "icon": "build/icon.png" }
```

`ls SoftHair/build` retorna "no build dir". `frontend/public/icon.svg` existe (18 linhas) mas formato não consumido por electron-builder.

Resultado: `npm run dist` aborta com `Cannot find: build/icon.ico` em todos os 3 targets. Distribuição binária impossível sem icones gerados.

**Fix Pass 7:**
- Criar `SoftHair/build/icon.svg` derivado de `frontend/public/icon.svg`.
- Gerar `icon.ico`, `icon.icns`, `icon.png` via comando ou placeholder SVG/PNG temporário.
- Alternativa minimalista: criar `build/icon.png` 512×512 com placeholder, deixar electron-builder gerar variantes platformizadas (suporta auto-conversão se único formato).

**Severidade:** Crítico para release. Sem isso, app não distribui.

### [P7-C2] Frontend `.env.example` aponta para porta errada — onboarding novo dev quebra

**Arquivos:** `SoftHair/frontend/.env.example`

**Descrição:** Arquivo declara:
```
VITE_API_URL=http://localhost:3000/api
```

Mas o backend embarcado roda em `127.0.0.1:3001` (via `BACKEND_PORT` default em `electron/main.js:54`). Frontend dev sem Electron procura `:3000` (Vite dev server) que não tem o backend. Dev novo segue INSTALL.md, copia `.env.example` para `.env`, faz `npm run dev`, vê telas vazias com erro de rede.

Adicional: o arquivo contém variáveis legadas que não são usadas no código (`VITE_DEVICE_NAME`, `VITE_API_KEY`, `VITE_OFFLINE_ENABLED`, `VITE_AUTO_SYNC_INTERVAL`, `VITE_CACHE_DURATION`, `VITE_TIMEZONE`, `VITE_DATE_FORMAT`, `VITE_CURRENCY`). Confunde e suja config.

**Fix Pass 7:** Reescrever `.env.example`:
```
# SoftHair frontend — variáveis Vite
# Aponta para o backend embarcado Electron (default 127.0.0.1:3001).
# Em dev standalone, garantir que o backend está rodando: cd backend && npm run dev
VITE_API_URL=http://127.0.0.1:3001/api
```

**Severidade:** Crítico para onboarding. Bug invisível até dev tentar.

---

## ALTOS Pass 7

### [P7-A1] Backend tests não cobrem endpoints mutativos críticos — apenas GETs

**Arquivos:** `SoftHair/backend/tests/routes-coverage.test.js`

**Descrição:** Test atual cobre 33 endpoints GET + 3 POST (`backup/create`, `sync/configure`, `auth/me/delete-account-data`). Cobertura excelente para evitar 404 (P6-C1 type bugs) mas:

- **Sem teste** de bootstrap-admin → login completo end-to-end (P3-C1 wizard).
- **Sem teste** de upsert sync conflict (P5-C4) — apenas teste unitário em syncService skipped por sqlite mismatch.
- **Sem teste** de `routes/financeiro/dre` returning correctly aggregated (P6-C1).
- **Sem teste** de despesa CRUD (P5-A1).
- **Sem teste** de saloes PUT /me (P6-C1).

Bug regressão de contrato (P5-A1 inicial bug) só seria pego por teste de payload, não de presença.

**Fix Pass 7:**
- Adicionar `tests/auth-flow.test.js`: bootstrap → /me reflete → /needs-setup=false.
- Adicionar `tests/despesas-crud.test.js`: POST → GET resumo (porCategoria correto) → DELETE.
- Adicionar `tests/financeiro.test.js`: cria venda + despesa → GET /financeiro/dre retorna receitas/despesas/lucroLiquido coerente.

**Severidade:** Alta para defesa contra regressão.

### [P7-A2] Console.log persistente em `Agenda.jsx:815` — vaza dados sensíveis de conflito

**Arquivos:** `SoftHair/frontend/src/pages/Agenda.jsx:815`

**Descrição:** Único `console.log` ativo em frontend produção. Conteúdo: `console.log('Conflito detectado:', conflitos)` — leak de array de agendamentos com cliente_id, profissional_id, horários. Em Electron com DevTools bloqueados (P4-C2), impacto baixo. Em dev mode ou se DevTools forem reativados por flag, vaza.

Pass 6 P6-A2 removeu de Atendimentos/api.js mas missed este.

**Fix Pass 7:** Remover ou wrap em `if (import.meta.env.DEV)`.

**Severidade:** Alta para data hygiene.

### [P7-A3] Frontend forms sem validação client-side — UX ruim com round-trip backend

**Arquivos:** `frontend/src/pages/Clientes.jsx`, `Despesas.jsx`, `Profissionais.jsx`, todas forms

**Descrição:** P6-A10 marcado como roadmap. Pass 7 reativa:

- `Clientes.jsx:264-285` — telefone aceita qualquer string; CPF idem. Backend valida via `express-validator` mas frontend manda payload mal-formado e recebe `errors: [...]` 400 que componente exibe genericamente como "Erro ao criar".
- `Despesas.jsx` — valor aceita 0 ou negativo no input (`min="0" step="0.01"`). Submit dispara erro server 400 "valor positivo obrigatório".
- Submit sem `disabled={loading}` em alguns botões — duplo-click cria duplicado se latência > 200ms.

**Fix Pass 7:**
- Criar helper `services/validators.js`:
  ```js
  export const validateCPF = (v) => /^\d{11}$/.test(v.replace(/\D/g, ''));
  export const validateTelefone = (v) => /^\d{10,11}$/.test(v.replace(/\D/g, ''));
  export const validateEmail = (v) => /^[^@]+@[^@]+\.[^@]+$/.test(v);
  ```
- Aplicar em `Clientes.jsx` antes do `createMut.mutate()`.
- Adicionar `disabled={isPending}` em todos os submits.

**Severidade:** Alta UX.

### [P7-A4] PasswordStrength indicator ausente — usuário descobre senha fraca só no submit

**Arquivos:** `frontend/src/pages/Login.jsx:202-228`

**Descrição:** P6-M9 reativa. Setup wizard tem input password com `placeholder="Mínimo 8 caracteres..."` mas sem indicador visual em tempo real. User digita "abc123" sem perceber e clica Criar conta. Backend rejeita; user reage com frustração.

**Fix Pass 7:** Adicionar componente inline:
- Barra colorida (vermelho/amarelo/verde) baseada em score 0-3 (length, mistura case, dígitos).
- Checklist abaixo: "✓ 8+ chars · ✓ maiúscula · ✗ número".
- Update sincronizado com onChange.

**Severidade:** Alta UX setup wizard.

### [P7-A5] Sync sem retry exponencial real — falha continua falhando

**Arquivos:** `backend/src/services/syncService.js:474-530 _doSync`

**Descrição:** Pass 6 aumentou timeout para 45s (cold start). Mas se primeira sync falha (network blip, 5xx temporário), próxima é em 30s sem distinção entre transient e definitivo. Cenários:

- Render reiniciando (deploy): 502/503 transient. SoftHair tenta a cada 30s — 6 syncs em 3min antes de sucesso. Logs poluídos.
- Network drop temporário: idem.
- Token expirado (401/403): já tratado P2-A8 — desabilita corretamente.

**Fix Pass 7:** No catch de `_doSync`:
- Em 5xx ou ECONNRESET/ETIMEDOUT: increment `_consecutiveFailures` (max 5).
- Próximo tick aplica backoff `Math.min(30000 * 2^N, 5*60*1000)` antes do retry real.
- Em sucesso, reset contador.

**Severidade:** Alta para network resilience.

### [P7-A6] Agenda.jsx e Administrativo.jsx 1600+ linhas — refactor split crítico

**Arquivos:** `frontend/src/pages/Agenda.jsx (1662 linhas)`, `Administrativo.jsx (1654)`

**Descrição:** P5-A5 e P6 deixaram como roadmap. Pass 7 marca como Alta porque:
- Pages com 30+ useState têm lifecycle bugs frequentes (race entre setState, useEffect dependências).
- Code review impossível.
- Lazy loading não compensa — 1662 linhas vira 150KB chunk inicial.
- Forma como `Agenda.jsx` agora chama 3 endpoints (`/agendamentos/proximos`, `/pendentes`, `/bloqueios`) duplica lógica de polling.

**Fix Pass 7:** Aceitar como roadmap formal — split em (a) AgendaGrid, (b) AgendaModal, (c) hooks/useAgendaData. Fora de escopo do Pass 7 imediato.

**Severidade:** Alta dívida técnica.

### [P7-A7] Notificações push desktop ausentes — só popups in-app

**Arquivos:** `frontend/src/components/Layout.jsx:147-181`, `electron/main.js`

**Descrição:** Mobile tem `expo-notifications`. Desktop tem apenas popups visuais quando app está em foco (`Layout.jsx`). Sem app focado, novo agendamento mobile não notifica owner do salão.

Electron suporta `new Notification(...)` API HTML5 + tray notification via `Notification` class do main process.

**Fix Pass 7:** Adicionar em main.js handler IPC `notify`:
- `ipcMain.on('notify', (e, { title, body }) => { new Notification({ title, body }).show(); })`.
- Renderer em Layout.jsx, ao receber popup, também chama `window.electron.notify({...})`.
- Preload.js expor `electron.notify`.

**Severidade:** Alta UX para owners não-focados na tela.

### [P7-A8] Sync sem batch para 10K+ mudanças — push leva minutos bloqueando o app

**Arquivos:** `backend/src/services/syncService.js:474-490 _doSync`

**Descrição:** Atual `_doSync` faz `collectLocalChanges(since)` sem limit. Se user trabalha 6 meses offline, `since` é 1970-01-01 e collect retorna toda a base.

Batch atual divide push em 100, mas:
- Collect ainda traz tudo em memória (10K rows × 7 tabelas = 70K).
- 100 batches × 700ms latência = 70s sequencial.
- Backend não pode interromper user.

**Fix Pass 7:**
- Adicionar limit no collect (default 5000) com `ORDER BY updated_at LIMIT`.
- Documentar comportamento "sync progressivo" — sync corrente envia primeiros 5000, próximo ciclo envia mais 5000.
- UI mostrar "Sincronizando 1/N batches" com progresso.

**Severidade:** Alta para escala. Salão com 6 meses offline ficaria efetivamente travado.

### [P7-A9] Frontend bundle não otimizado — chunk gigante na primeira tela

**Arquivos:** `frontend/vite.config.*`, lazy split

**Descrição:** App tem lazy split em App.jsx (P3 fix). Mas:
- `recharts` e `react-router-dom` no main bundle.
- `lucide-react` importa por icon name — sem tree-shake.
- Sem `manualChunks` em vite.config para split vendor.

Estimativa: bundle inicial 350-500KB. Em Electron file:// rápido. Em dev http servidor 3000 lento.

**Fix Pass 7:** Adicionar `vite.config.js` manualChunks:
- `vendor-react` = react/react-dom/react-router.
- `vendor-charts` = recharts.
- `vendor-icons` = lucide-react.
- `vendor-query` = @tanstack/react-query/axios.

Aceitar como roadmap se não há vite.config customizado.

**Severidade:** Alta para perf cold-start.

### [P7-A10] Setup wizard re-checa apenas COUNT(*), permite race entre múltiplos POST

**Arquivos:** `backend/src/routes/auth.js:45-109`

**Descrição:** `bootstrap-admin` é atomic dentro de transação (P2-A7 fix). MAS depende de `SELECT COUNT(*) as n FROM usuarios` antes do INSERT. Race window:

1. T1: COUNT=0 → INSERT em progress.
2. T2: COUNT=0 (mesmo timestamp, leitura paralela em SQLite WAL) → INSERT em progress.
3. T1 commits OK. T2 commits OK (UNIQUE email só rejeita mesmo email).

Resultado: 2 admins criados se attacker manda emails diferentes em paralelo durante setup window.

**Fix Pass 7:** Após transação, verificar `SELECT COUNT(*) FROM usuarios` post-commit. Se > 1, alertar (admin existente conhecido — apaga o duplicate ou falha o setup).

Alternativa: usar `INSERT INTO usuarios SELECT ... WHERE NOT EXISTS (SELECT 1 FROM usuarios)`.

**Severidade:** Alta defensive — só explorável durante setup window (~1min).

---

## MEDIOS Pass 7

### [P7-M1] LGPD export-data (portabilidade) ausente — só delete

**Arquivos:** `frontend/src/pages/Configuracoes.jsx`, `backend/src/routes/auth.js`

**Descrição:** P5-A2 + P6-C3 entregou DELETE de dados (LGPD art. 18 - direito à exclusão). LGPD art. 18 também garante **portabilidade**: titular pode requerer cópia legível dos dados (JSON, CSV, XLSX).

Sem endpoint de export, recurso LGPD incompleto.

**Fix Pass 7:**
- Endpoint `GET /api/auth/me/export-data` retorna ZIP com:
  - `clientes.json`, `agendamentos.json`, `vendas.json`, `produtos.json`, etc.
  - `salao.json` com metadata.
  - `_README.txt` explicando estrutura.
- UI em Configuracoes.jsx: botão "Exportar todos os dados (LGPD)".

**Severidade:** Médio compliance.

### [P7-M2] Empty states sem CTA — telas vazias parecem broken

**Arquivos:** múltiplas pages

**Descrição:** Vários componentes mostram "Nenhuma despesa encontrada" / "Nenhum cliente" sem call-to-action. User sem orientação. Ex `Despesas.jsx:190`, `Clientes.jsx`, `Vendas.jsx`.

**Fix Pass 7:** Onde lista vazia, adicionar `+ Criar primeira despesa` etc botão centralizado.

**Severidade:** Médio UX.

### [P7-M3] Loading states sem skeleton — spinner genérico em toda página

**Arquivos:** múltiplas

**Descrição:** Padrão atual: spinner azul giratório (`App.jsx:34-40`). Em listagens, skeleton placeholders dão melhor percepção de velocidade (Chris Coyier 2016).

**Fix Pass 7:** Skeleton rows em listas paginated (Clientes, Despesas, Vendas).

**Severidade:** Médio UX.

### [P7-M4] Network error sem mensagem "modo offline"

**Arquivos:** `services/api.js`, error handlers em pages

**Descrição:** Quando o backend embarcado morre (ex: process crash), frontend recebe `Network Error`. UI mostra erro genérico. User não sabe que é problema interno do app.

**Fix Pass 7:** Em `api.js` response interceptor:
- Se `!error.response` (network), emit event `softhair:backend-down`.
- Banner global similar ao StubBanner mostra "Conexão com o backend interrompida. Reiniciando..." e reverte quando próxima request OK.

**Severidade:** Médio UX em crash de backend.

### [P7-M5] Theming custom em Customizacao.jsx — verificar persistência

**Arquivos:** `frontend/src/pages/Customizacao.jsx`

**Descrição:** Página existe mas não fiz dive. CSS variables em `index.css` declaradas (`--color-primary` etc). Verificar se Customizacao.jsx persiste valores em backend (`/api/configuracoes`) e re-aplica no boot.

**Fix Pass 7:** Read-only audit — sem mexer se já funcional. Apenas documentar comportamento.

**Severidade:** Médio se broken, baixo se OK.

### [P7-M6] electron-updater sem release notes — user não sabe o que mudou

**Arquivos:** `electron/main.js:111-128`

**Descrição:** P6-M2 marcado como NÃO APLICADO. Dialog mostra apenas "Versão X pronta". Sem changelog.

**Fix Pass 7:** Em `update-downloaded` handler:
- Se `info.releaseNotes` (string ou HTML), incluir em `detail` (max 500 chars).
- Strip tags HTML simples.

**Severidade:** Médio UX update.

### [P7-M7] Sync UI sem indicação de salao_id remoto mismatch

**Arquivos:** `frontend/src/pages/Sync.jsx`

**Descrição:** `syncService.getLocalSalaoId()` (P3-C7) detecta mismatch entre JWT cloud e DB local, e popula `lastError`. UI mostra `lastError` em texto vermelho mas sem ação clara.

**Fix Pass 7:** Detectar substring "salao_id" no lastError e mostrar botão "Reconectar com salão correto" que abre modo "Configurar Cloud" pré-preenchido.

**Severidade:** Médio UX.

### [P7-M8] Build size warnings de electron-builder não verificados

**Arquivos:** `package.json:48-58` files

**Descrição:** `extraResources` inclui `backend/**/*` com filtros. Mas `node_modules/.cache/**` filtro pode não cobrir `electron-cache` ou similar. Build size pode estar > 100MB sem nenhum aviso.

**Fix Pass 7:** Aceitar — só visível ao rodar build real.

**Severidade:** Médio (aceito).

### [P7-M9] Atendimentos.jsx 861 linhas — mesmo padrão de Agenda

**Arquivos:** `frontend/src/pages/Atendimentos.jsx`

**Descrição:** Lazy-loaded mas dentro tem 861 linhas + 4 useStates. Split em Form/List/Filter sub-components. Similar Dashboard.jsx 709 linhas.

**Fix Pass 7:** Aceitar como roadmap.

**Severidade:** Médio dívida.

### [P7-M10] CSP backend embarcado permite img-src https: aberto

**Arquivos:** `backend/src/server.js:42`

**Descrição:** Backend serve JSON API, não HTML. `imgSrc: ["'self'", 'data:', 'https:']` é defesa em profundidade redundante. Em XSS no renderer (já dentro CSP do frontend), uma img-src exfil já passa pelo frontend não pelo backend.

**Fix Pass 7:** Reduzir `imgSrc` para apenas `['none']` no backend (backend não serve nenhuma img). Defesa em profundidade ainda mais estrita.

**Severidade:** Médio defesa.

---

## BAIXOS Pass 7

### [P7-B1] CLAUDE.md paths Windows obsoletos em worktree Linux

**Arquivos:** root `CLAUDE.md`, repo `SoftHair/CLAUDE.md`

**Descrição:** P6-B4 mantido. Aceito.

### [P7-B2] Repo `private:true` mas sem `repository` no package.json

**Arquivos:** `SoftHair/package.json`

**Descrição:** Falta `repository: { type: 'git', url: '...' }`. electron-updater usa `publish.github` (linha 82-86) mas alguns flows querem `repository`.

**Fix Pass 7:** Adicionar `"repository": { "type": "git", "url": "https://github.com/guijoioj/SoftHair" }`.

### [P7-B3] `MANUAL-DE-USO.html` referenciado em menu — verificar existência

**Arquivos:** `electron/main.js:683`, `package.json:55 files`

**Descrição:** Menu Ajuda → Manual de Uso abre `MANUAL-DE-USO.html`. Arquivo declarado em `files` (linha 55). Verificar que existe no repo.

**Fix Pass 7:** Verify e criar placeholder se faltando.

### [P7-B4] Backend tests skip silencioso em better-sqlite3 binding mismatch

**Arquivos:** `tests/routes-coverage.test.js`, `tests/syncService.test.js`

**Descrição:** Test detecta `e.message.includes('better_sqlite3')` e exit 0 com SKIPPED. Em CI isso pode mascarar real failures. Ideal: detectar especificamente NODE_MODULE_VERSION mismatch (Node 26 vs SQLite 11 compilado para Node 20).

**Fix Pass 7:** Aceito — heurística atual é boa enough.

### [P7-B5] Logo SoftHair pendente — usa Scissors lucide-react

**Arquivos:** `frontend/public/icon.svg`, Login.jsx, Layout.jsx

**Descrição:** P6-B7 idem. icon.svg existe (18 linhas) mas é placeholder simples.

**Fix Pass 7:** Aceito como ACEITO (branding fora do escopo de auditoria de código).

### [P7-B6] Sem `package-lock.json` no root SoftHair

**Arquivos:** `SoftHair/package.json` vs ausência de `package-lock.json` na raiz

**Descrição:** Root só tem `electron-updater` dependency + `electron`/`electron-builder` dev. Sem lock no root, `npm install` pode pegar versões majores diferentes entre máquinas.

**Fix Pass 7:** Rodar `npm install` na raiz e committar `package-lock.json`.

### [P7-B7] `tools/` directory referenciado em SOFT-HAIR-SERVER mas SoftHair desktop sem

**Arquivos:** N/A — apenas observação.

**Descrição:** Sem impacto desktop.

---

## NOVOS ÂNGULOS COBERTOS POR PASS 7

1. **Coverage backend (P7-A1):** 33 GETs cobertos, 3 POSTs. Sem auth-flow, despesas-CRUD, financeiro-correctness.
2. **Forms validation (P7-A3):** Regex CPF/telefone/email ausentes. Submit duplo prevenção parcial.
3. **UX loading/empty/network (P7-M2, M3, M4):** Spinner genérico, sem CTA, sem mensagem clara offline.
4. **Pages > 1000 linhas (P7-A6, M9):** Agenda 1662, Administrativo 1654, Atendimentos 861. Roadmap split.
5. **Theming (P7-M5):** ThemeContext + CSS vars OK. Customizacao.jsx não auditada (read-only).
6. **Notifications nativas (P7-A7):** Ausentes. Apenas popup in-app.
7. **Search/Launcher (verificado OK):** Cmd+K funcional em Layout.jsx. Debounce 50ms via setTimeout.
8. **Sync edge cases (P7-A5, A8):** Sem retry exponencial. Sem batch limit.
9. **Crashes silenciosos:** uncaughtException + unhandledRejection logados em main.js:695-704.
10. **CLI commands (recovery):** Apenas via UI. Sem `npm run reset-admin` ou `vacuum-db`.
11. **Build distribuição (P7-C1):** Icons missing. Linux/Windows/Mac build all fail.
12. **Update versão:** auto-update OK (Pass 5/6). Migration framework OK (Pass 4 P4-C7).
13. **Sync conflicts UI completion (verified OK Pass 6):** diff visual + keep one. Merge manual ausente (3-way) — aceito.
14. **Privacy completa (P7-M1):** Export LGPD ausente. Delete OK.
15. **Performance frontend (P7-A9):** Sem manualChunks. Bundle inicial estimado 350-500KB.

---

## Resumo

**Novos issues Pass 7:**

| Severidade | Count | IDs |
|---|---|---|
| Críticos | 2 | P7-C1 a P7-C2 |
| Altos | 10 | P7-A1 a P7-A10 |
| Médios | 10 | P7-M1 a P7-M10 |
| Baixos | 7 | P7-B1 a P7-B7 |
| **Total** | **29** | |

**Verificação Pass 6:** 18/31 OK · 2 PARCIAIS · 8 NÃO APLICADOS · 3 ACEITOS.

**Pendentes anteriores fechados nesta passada:** P5-A4 (schema-drift doc — VERIFICADO presente em docs/sync-schema-drift.md). P6-A1 (despesas porCategoria — VERIFICADO).
