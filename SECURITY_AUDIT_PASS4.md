# Security Audit Pass 4 — SoftHair

**Data:** 2026-05-11
**Status:** FIXES APLICADOS — 22 fixados / 7 aceitos com justificativa. Smoke tests 3/3 PASS.
**Auditor:** Pass 4 (quarta passada após cleanup do Pass 3).
**Escopo:** SOFT-HAIR-SERVER, SoftHair/frontend, softhair-mobile.
**Tipo:** Defensiva — análise estática. Foco em ângulos NUNCA auditados nos Passes 1–3: lateral movement entre tipos de usuário, SSRF, endpoints esquecidos, cancelamento de venda com restore de estoque cross-tenant, comportamentos cosméticos de outras rotas (bloqueios, configurações, fidelidade, atendimentos).

## Verificação de fixes Pass 3 (cleanup 2026-05-11)

| ID  | Status pós-Pass3 cleanup | Observação |
|-----|--------------------------|------------|
| P3-M6 | ⏸️ ACEITO (doc) | Comentário inline registra contrato defense-in-depth em `AgendamentoService.cancelar` para uso futuro. |
| P3-M7 | ✅ FIXADO | Bundle entry: **1007 KB → 27 KB** (-97%). manualChunks + React.lazy aplicados. |
| P3-B2 | ⏸️ ACEITO | Comportamento intencional (pre-onboarding). |
| P3-B7 | ⏸️ ACEITO | Tracking único em Pass 1 [A6]. |

Smoke tests pós-cleanup: **3/3 PASS** (jest --runInBand, ~63s).

---

## Novos issues encontrados

### 🔴 CRÍTICOS

#### [P4-C1] ✅ FIXADO — Lateral movement: JWT de cliente/profissional aceito em endpoints de admin (não-`requireAdmin`)
- **Arquivos:** `SOFT-HAIR-SERVER/src/middleware/auth.js#authMiddleware`, todas as rotas de admin que usam SOMENTE `authMiddleware` sem `requireAdmin` — `clientes.js`, `agendamentos.js`, `produtos.js`, `servicos.js`, `vendas.js`, `atendimentos.js`, `comissoes.js (GET)`, `creditos.js`, `notificacoes.js`, `historico.js`, `fidelidade.js`, `bloqueios.js`, `configuracoes.js`, `caixa.js`, `metas.js`, `relatorios.js`, `financeiro.js`, `despesas.js`, `fechamentos.js`, `sync.js`.
- **Descrição:** `authMiddleware` aceita QUALQUER JWT válido com `salaoId` (assinado pelo mesmo `JWT_SECRET`), incluindo tokens emitidos por `appAuth.js` (`type='cliente'`) e `appProfissionalAuth.js` (`type='profissional'`). Os middlewares específicos (`clienteAuthMiddleware`, `profissionalAuthMiddleware`) verificam `decoded.type` e rejeitam tokens de admin. Mas o caminho inverso **não é simétrico**: `authMiddleware` NÃO rejeita tokens com `decoded.type === 'cliente'` ou `'profissional'`. Apenas `requireAdmin` (em algumas rotas) checa `req.user.tipo === 'admin'` — e tokens de cliente/profissional não têm `tipo` (têm `type`), então `requireAdmin` os bloqueia. Mas **rotas que usam apenas `authMiddleware` sem `requireAdmin`** aceitam o cliente como se fosse staff do salão.
- **Exploração:**
  1. Cliente legítimo do salão A loga via `POST /api/app/auth/login` → recebe JWT com `{ clienteId, type: 'cliente', salaoId: A }`.
  2. Cliente envia esse JWT para `GET /api/clientes` → `authMiddleware` aceita (JWT válido, `salaoId` setado), retorna **lista completa de clientes do salão A** (CPF, telefone, email, créditos, etc.).
  3. Idem: `GET /api/agendamentos`, `GET /api/vendas`, `GET /api/financeiro`, `GET /api/relatorios` — todos os dados internos do salão expostos ao usuário-cliente.
  4. **Mutação:** `POST /api/clientes`, `PUT /api/clientes/:id`, `DELETE /api/clientes/:id`, `POST /api/agendamentos`, `PUT /api/agendamentos/:id`, `POST /api/atendimentos`, `POST /api/vendas`, etc. — cliente pode CRIAR/EDITAR/DELETAR registros internos do salão. **CRUD admin completo concedido ao cliente.**
- **Impacto:** Total comprometimento de confidencialidade e integridade dos dados internos do salão. Cliente vira "admin de fato" sobre tudo que não esteja protegido por `requireAdmin` — que cobre apenas auth/device/apikey, alguns endpoints de profissionais, backup/restore e comissões/pagar+estornar. **TODO O RESTO está aberto.**
- **Fix:** Em `authMiddleware`, após `decoded = verifyToken(token)`, verificar:
  ```js
  // [P4-C1] Bloquear tokens de cliente/profissional em endpoints admin.
  if (decoded.type === 'cliente' || decoded.type === 'profissional') {
    return res.status(403).json({ success: false, error: 'Token de usuário móvel não autorizado neste endpoint' });
  }
  ```
  Alternativa robusta: exigir afirmativamente `decoded.tipo` (admin/recepcionista/staff) ou `decoded.userId` presentes, e rejeitar tokens que não tenham. Ou criar duas funções distintas — `requireAdminToken` (default em rotas /api/*) vs `authMiddleware` (interno, sem prejulgar tipo).

#### [P4-C2] ✅ FIXADO — `POST /api/bloqueios` aceita `salaoId` do body + `DELETE /api/bloqueios/:id` sem filtro de tenant
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/bloqueios.js:37-58, 60-75`
- **Descrição:** Mesma família do antigo P3-C1 (device register), mas NÃO foi coberta no fix daquele:
  1. **POST:** `const { salaoId, ... } = req.body; INSERT INTO bloqueios_horario (salao_id, ...) VALUES ($1, ...) [salaoId || null, ...]`. Admin do salão A pode criar bloqueio de horário em salão B passando `salaoId: <B>` no body. Não usa `req.salaoId` do JWT.
  2. **POST:** `profissionalId` também não é validado contra `salao_id` — pode apontar para profissional de outro salão.
  3. **DELETE:** `DELETE FROM bloqueios_horario WHERE id = $1` — SEM `AND salao_id = $X`. Admin do salão A pode deletar bloqueios de qualquer salão se souber/iterar o ID.
- **Exploração:**
  - DoS de agenda em outro salão: admin de A cria 1000 bloqueios em B com `salaoId: B` → inviabiliza agendamentos em B.
  - Limpeza maliciosa: admin de A faz `DELETE /api/bloqueios/1`, `/2`, `/3` → apaga bloqueios reais de outros salões.
- **Fix:** Forçar `salao_id = req.salaoId` no INSERT. Validar `profissionalId` tenancy. Adicionar `AND salao_id = $X` ao DELETE com `RETURNING` para 404 correto.

#### [P4-C3] ✅ FIXADO — `POST /api/fidelidade/adicionar` — pontos arbitrários sem tenancy de cliente
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/fidelidade.js:29-41`
- **Descrição:**
  - Não valida `clienteId` contra `req.salaoId` antes do INSERT.
  - Não valida `pontos` (aceita negativos, 0, 1e15) — mass-assignment.
  - Combinado com P4-C1, **um cliente** poderia adicionar pontos a si mesmo (forjando `clienteId` arbitrário) e depois resgatar (próximo issue).
- **Exploração:** Cliente loga, descobre próprio `clienteId`, faz `POST /api/fidelidade/adicionar { clienteId: <seu>, pontos: 999999 }` e em seguida `POST /api/fidelidade/resgatar { clienteId, pontos: 999999, descricao: 'free stuff' }`.
- **Fix:** Validar `clienteId` pertence a `req.salaoId`. Validar `pontos` em range `[1, 100000]`. Adicionar `requireAdmin` (apenas admin atribui pontos manualmente).

#### [P4-C4] ✅ FIXADO — `POST /api/fidelidade/resgatar` — race condition permite double-spend de pontos
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/fidelidade.js:42-58`
- **Descrição:** Fluxo: lê `SUM(pontos)` → compara com `pontos` solicitados → INSERT linha com `-pontos`. Sem transação, sem `SELECT ... FOR UPDATE`, sem `INSERT ... WHERE NOT EXISTS`. Duas requisições concorrentes com saldo=100 e pontos=100 podem ambas passar pela checagem antes de qualquer INSERT, resultando em saldo final de `-100`.
- **Fix:** Envolver em `withTransaction` com `SELECT FOR UPDATE` da soma agregada, ou usar advisory lock por `(salao_id, cliente_id)`, ou implementar via `CHECK (saldo - novo_resgate >= 0)`.

### 🟠 ALTOS

#### [P4-A1] ✅ FIXADO — `VendaService.cancelar` restaura estoque sem filtro de tenancy
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/VendaService.js:189-193`
- **Descrição:**
  ```js
  for (const item of itens.rows) {
    await client.query('UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2', [item.quantidade, item.produto_id]);
  }
  ```
  Embora o fix P3-C2 tenha endurecido a CRIAÇÃO da venda (FK tenancy + UPDATE com `salao_id`), o **cancelamento** ainda restaura estoque sem `AND salao_id = $X`. Cenário residual: registros legados anteriores ao fix P3-C2 podem ter `venda_itens.produto_id` apontando para produto de OUTRO salão (já que não havia FK composta). Cancelar tal venda agora incrementa estoque de produto alheio.
- **Fix:** `UPDATE produtos SET quantidade_estoque = quantidade_estoque + $1 WHERE id = $2 AND salao_id = $3` usando o `salaoId` do parâmetro.

#### [P4-A2] ✅ FIXADO — `AtendimentoService.criar` — sem tenancy de FKs + `valor` arbitrário
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/AtendimentoService.js:64-74`
- **Descrição:** Padrão idêntico ao P3-A1 do agendamentos, mas em atendimentos:
  - `data.cliente_id`, `data.profissional_id`, `data.servico_id`, `data.agendamento_id` inseridos sem `WHERE salao_id = $X`. Admin (ou cliente, via P4-C1) cria atendimento que referencia entidades de outro salão.
  - `data.valor` é arbitrário — não busca `servicos.preco`. Atendimento pode ter R$ 999.999 e quebrar relatórios, ou R$ 0 para esconder receita.
- **Fix:** Validar tenancy de cada FK contra `salaoId`. Buscar `preco` autoritativo de `servicos.preco`. Mesmo padrão de `VendaService.criar` pós-P3-C2.

#### [P4-A3] ✅ FIXADO — `PUT /api/atendimentos/:id` permite alterar `valor` arbitrariamente
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/AtendimentoService.js:77-90`
- **Descrição:** `valor = COALESCE($3, valor)` aceita qualquer número. Combinado com geração de comissão downstream (se houver hook), pode inflacionar comissão do profissional.
- **Fix:** Bloquear edição de `valor` após criar (read-only após `status='finalizado'`), ou recalcular do `servico.preco` correspondente.

#### [P4-A4] ✅ FIXADO — `/api/configuracoes PUT /` — mass-assignment de chave/valor arbitrários
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/configuracoes.js:18-31`
- **Descrição:** Aceita `{ chave, valor }` sem whitelist. Atacante (admin de salão ou — via P4-C1 — cliente) pode criar/sobrescrever configurações sensíveis: ex.: chave `webhook_url`, `external_api_endpoint`, `feature_flag.*`, etc. Embora hoje o frontend só consuma chaves conhecidas, **futuro** uso para feature-flags ou integração externa explode em vulnerabilidade.
- **Fix:** Whitelist explícita de `chave` em `CONFIG_ALLOWED_KEYS`. Idealmente migrar `configuracoes` para colunas tipadas em vez de KV genérico.

#### [P4-A5] ✅ FIXADO — `GET /api/configuracoes/navegadores` — information disclosure do servidor (fs paths)
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/configuracoes.js:37-52`
- **Descrição:** Endpoint **público dentro do router que tem `authMiddleware` antes** (`router.use(authMiddleware)`), então só authenticated. Mas executa `fs.existsSync('/usr/bin/firefox')` etc. e retorna o caminho ao cliente. Em produção no Render (Linux), responde com caminhos reais; em ambiente Windows do desktop, responde vazio (paths Linux-only). Vazamento de informações da infraestrutura: confirma OS, ferramentas instaladas, possíveis hardening gaps.
- **Fix:** Endpoint é claramente artefato de quando backend rodava embutido no desktop Electron. **Em servidor remoto (Render), não tem razão de existir.** Remover ou retornar `[]` em produção (`process.env.NODE_ENV === 'production'`).

#### [P4-A6] ✅ FIXADO — `POST /api/auth/register` — endpoint público permite criar salão SEM rate limit específico
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/auth.js:8-33`
- **Descrição:** A rota está sob `_authSensitive` (que aplica `authLimiter` 5/15min por IP+email), mas como cria um **novo email** a cada call, o `keyGenerator` produz uma chave única por tentativa. Resultado: rate limit funcional apenas se o atacante reusar o mesmo email. Spammer pode criar 1000 salões por IP iterando email. Sem captcha, sem proof-of-work, sem confirmação de email.
- **Exploração:** DoS por inflação de tabela `saloes` + `usuarios`. Cada salão consume registros, e o admin padrão fica imediatamente válido (sem confirmação).
- **Fix:** Adicionar rate limit dedicado por IP (não por email) — ex.: 3 registros/dia por IP. Ou exigir confirmação por email antes de ativar.

#### [P4-A7] ✅ FIXADO — Endpoint `/api/ai/command` executa `create_agendamento` sem validação do `clienteId` em `req.salaoId`
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/ai.js` (sequência pós-`parsed.data` linhas ~130+)
- **Descrição:** Após o LLM resolver `clienteId`/`professionalId`/`serviceId`, a rota chama o caminho de criação. Audit limitado mostra que ele faz busca por nome com `WHERE salao_id = $1` (bom), mas o `serviceId`/`professionalId` resolvidos no array `profsRes`/`servicosRes` foram pegos com `salao_id = req.salaoId` (também bom). Risco residual: se o caller passa `parsed.data.clienteId` diretamente forjando (prompt injection no `command`), o LLM pode emitir um JSON com `clienteId` arbitrário — e o código abaixo de `if (d.clienteName && !d.clienteId)` só busca por nome quando clienteId está ausente. Se o LLM responder `{ clienteId: <arbitrário>, ... }`, isso é usado sem validar tenancy. **Não vi proteção downstream contra `parsed.data.clienteId` forjado.**
- **Fix:** Após parse, **sobrescrever** `d.clienteId/professionalId/serviceId` apenas se forem resultado da busca interna; nunca confiar em IDs vindos do JSON do LLM. Validar tenancy antes da execução final.

### 🟡 MÉDIOS

#### [P4-M1] ✅ FIXADO — `jwt.verify` chamado sem `algorithms` explicit — confia no default da lib
- **Arquivos:** `src/middleware/clienteAuth.js`, `appAuth.js`, `profissionalAuth.js`, `services/websocketService.js`, `services/authService.js`
- **Descrição:** `jwt.verify(token, JWT_SECRET)` sem `{ algorithms: ['HS256'] }`. Em `jsonwebtoken@9.0.3` (instalado), o default é HS256 quando o secret é string, **mas** se algum dia alguém trocar `JWT_SECRET` por um PEM (acidental ou via migração), aceita RS256/ES256 — e atacante com chave pública conhecida pode falsificar. Defesa em profundidade: sempre travar algorithms.
- **Fix:** Adicionar `{ algorithms: ['HS256'] }` em todos os call sites de `jwt.verify`.

#### [P4-M2] ✅ FIXADO — `emailService.sendPasswordResetEmail` hardcoded `http://localhost:3000/reset-password/${token}`
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/emailService.js:30`
- **Descrição:** Email de reset envia URL `http://localhost:3000/...` — quebrado em produção. Implica: (a) ou o fluxo de reset **não está em uso real** (nenhuma rota expõe esse service); (b) ou usuários reais recebem email com URL `localhost`. Auditando rotas: não há `POST /api/auth/forgot-password` em uso. Mas o `emailService` está disponível para `require`, podendo ser chamado por outro caminho. **Risco baixo de exploit, alto de UX/operacional.**
- **Fix:** Ler de `process.env.FRONTEND_URL || 'http://localhost:3000'`. Adicionar validação para evitar template injection se `email` for usado em SMTP injection (não é o caso atual).

#### [P4-M3] ✅ FIXADO — `POST /api/notificacoes` permite criar notificação sem validar `cliente_id` cross-tenant
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/notificacoes.js:30-43`
- **Descrição:** Validator só exige `tipo/titulo/mensagem`. O `body` é passado direto pro `service.criar(req.body, req.salaoId)`. Se body trouxer `cliente_id` ou `destinatario_id`, e o `service.criar` apenas insere `salao_id` mas não valida FKs — atacante apontaria notificação para cliente de outro salão. Listagem por `salao_id` mitiga visualização, mas pode poluir auditoria.
- **Fix:** Validar `cliente_id`/`usuario_id` se presentes contra `req.salaoId`. Whitelist de campos editáveis.

#### [P4-M4] ✅ FIXADO — WebSocket: `JSON.parse(message)` sem proteção contra mensagens >1MB
- **Arquivo:** `SOFT-HAIR-SERVER/src/services/websocketService.js:78`
- **Descrição:** `ws@8.20` por default aceita mensagens até `maxPayload` (sem override = 100 MiB). Cliente autenticado pode mandar JSON de 100MB, causando `JSON.parse` síncrono que bloqueia o event loop (DoS) e gasta memória. Não testado em prática mas é vetor.
- **Fix:** Em `new WebSocket.Server({ ..., maxPayload: 64 * 1024 })`. 64 KB é suficiente para chat e comandos.

#### [P4-M5] ✅ FIXADO — `npm production` audit limpo, mas Node 26 em CI/dev local — incompatível com Render
- **Arquivos:** `package.json` `engines.node: ">=18.0.0"`, ambiente local roda Node 26.1.0.
- **Descrição:** Node 26 ainda não foi LTS-promovido (jan 2026). Algumas APIs experimentais (`localStorage` warning visto nos testes) podem comportar-se diferente entre Node 18 do Render e Node 26 dev. Risco baixo.
- **Fix:** Travar `engines.node` em `"18.x"` ou `"20.x"` (LTS atual no Render). Documentar versão exigida.

#### [P4-M6] ✅ FIXADO — `/api/sync/push` aceita até 500 mudanças sem validação extra de payload total
- **Arquivo:** `SOFT-HAIR-SERVER/src/routes/sync.js:142-148`
- **Descrição:** `changes.length > 500` check existe, mas com global JSON limit de 1MB cada change pode ser ~2 KB. Ainda assim, 500 INSERTS dentro de uma transação serializável podem causar long-lock no Postgres. Atacante autenticado pode disparar muitas concorrentes consumindo conexões.
- **Fix:** Limitar `changes.length` para 100, e implementar timeout por transação (`statement_timeout`).

#### [P4-M7] ✅ FIXADO — `bcrypt.compare` precedido de branch que pode vazar existência de usuário (timing)
- **Arquivos:** `src/services/authService.js#login`, `src/routes/appAuth.js#login`, `src/routes/appProfissionalAuth.js#login`
- **Descrição:**
  ```js
  if (!user) throw new Error('Credenciais inválidas');
  const validPassword = await bcrypt.compare(senha, user.senha_hash);
  ```
  Se `user` não existe, retorna imediato (~ms). Se existe e senha errada, executa `bcrypt.compare` (~100ms). Diferença mensurável → user enumeration por timing. O lockout (`accountLockout`) mitiga via rate limit, mas timing ainda é mensurável em uma janela curta (5 reqs antes do block).
- **Fix:** Quando user não existe, executar `bcrypt.compare(senha, '$2a$12$' + 'X'.repeat(53))` dummy para constantizar tempo. Ou usar `crypto.timingSafeEqual` em wrapper.

#### [P4-M8] ✅ FIXADO — `req.query` arrays via parameter pollution não testado
- **Arquivos:** `routes/agendamentos.js`, `routes/clientes.js`, etc.
- **Descrição:** Express por default trata `?id=1&id=2` como `['1','2']` (array). Endpoints como `GET /api/agendamentos?cliente_id=1&cliente_id=2` passam array para `service.listar`. Se o service constrói SQL como `cliente_id = $1` com `params.push(filtros.cliente_id)` e o `pg` rejeita arrays em coluna integer, vira erro 500. Não é exploit, mas é DoS via 500 + log spam.
- **Fix:** Normalizar `req.query.X = Array.isArray(X) ? X[0] : X` no boot ou em validadores.

### 🟢 BAIXOS

#### [P4-B1] ⏸️ ACEITO — `JWT_SECRET` mesmo para JWT admin e cliente/profissional
**Justificativa:** P4-C1 já bloqueia o vetor real (token cliente/profissional não passa por `authMiddleware`). Segregação de secrets é defense-in-depth; backlog para próximo ciclo (exige rotação coordenada + migração de tokens em circulação).
- **Arquivos:** `services/authService.js`, `routes/appAuth.js`, `routes/appProfissionalAuth.js`
- **Descrição:** Todos os tipos de token assinados com o mesmo `JWT_SECRET`. Se um leak parcial expor ou se um sistema externo emitir token, conseguiria forjar tokens de TODOS os tipos. Defense in depth: separar `JWT_SECRET_ADMIN`/`JWT_SECRET_CLIENT`/`JWT_SECRET_PROF`. (Hoje, `decoded.type` é a única barreira — vide P4-C1.)
- **Fix:** Considerar segregar secrets por tipo.

#### [P4-B2] ⏸️ ACEITO — `bcrypt.compare` retorna em tempo variável conforme tamanho do hash
**Justificativa:** Cosmético. Todos os hashes usam rounds=12 com length constante. P4-M7 já cobriu o vetor real (login com user inexistente).
- **Descrição:** Cosmético — bcrypt.compare é constant-time para hashes do mesmo length. Como todos usam rounds=12, length é constante. Sem ação.

#### [P4-B3] ⏸️ ACEITO — `/api/health` retorna `services: { database: 'connected' }` sem validar pool ativo
**Justificativa:** `SELECT 1` valida que UMA conexão funciona, suficiente para o uso atual do Render health-check. Monitoramento granular do pool é função de APM externo, não do endpoint /health.
- **Arquivo:** `src/routes/health.js`
- **Descrição:** `await pool.query('SELECT 1')` valida UMA query síncrona, mas não verifica que o pool não está exausto. Sem ação imediata.

#### [P4-B4] ⏸️ ACEITO — Cookies não usados, mas `credentials: true` em CORS habilita possíveis side-effects futuros
**Justificativa:** Comportamento intencional — manter `credentials:true` permite migração futura para auth via cookie sem rebuild de CORS. Sem cookie hoje não há vetor CSRF real.
- **Arquivo:** `src/server.js:62`
- **Descrição:** Atual app só usa Bearer header, mas `credentials:true` permanece. Caso alguém adicione cookies, automaticamente vira CSRF-vulnerable.
- **Fix:** Como app não usa cookies, considerar `credentials:false`. Documentar antes da mudança (impacto em onboard de cookies).

#### [P4-B5] ✅ FIXADO — WebSocket `verifyClient` não valida `decoded.type` — token cliente abre WS em /ws sem restrição
- **Arquivo:** `services/websocketService.js:45`
- **Descrição:** Cliente mobile pode abrir WS e receber broadcasts de `salaoId` (como se fosse admin). Como brocasts são por canal (subscribe explícito) e canais admin não são divulgados publicamente, risco baixo — mas é simétrico ao P4-C1.
- **Fix:** Em `verifyClient`, separar canais por `decoded.type`; ou em `subscribeClient`, restringir canais admin para tokens admin.

#### [P4-B6] ✅ FIXADO — `console.log` de comando IA loga primeiros 200 chars de `command` (PII potencial)
- **Arquivo:** `src/routes/ai.js:108`
- **Descrição:** Logs do Render podem conter trechos de comando do usuário. Geralmente não-PII, mas se admin digitar "Agendar Maria 11999998888 para amanhã às 14h" o telefone vai pro log.
- **Fix:** Redação de regex de telefone/CPF/email antes de logar.

#### [P4-B7] ⏸️ ACEITO — `GET /api/configuracoes/navegadores` — duplicado em B5 acima como A5 (mais grave por info disclosure)
**Justificativa:** Duplicata de P4-A5 (já fixado). Sem ação adicional.

#### [P4-B8] ✅ FIXADO — `BookupService.ALLOWED_COLUMNS` permite `senha_hash` em profissionais durante restore
- **Arquivo:** `services/BackupService.js:24`
- **Descrição:** Restore aceita reescrever `senha_hash` de profissionais. Backup é admin-only e por design re-cria o estado anterior, então é tecnicamente correto. Mas se um backup for adulterado offline, restore pode injetar `senha_hash` controlada pelo atacante para se logar como qualquer profissional. Defense in depth: rejeitar `senha_hash` em restore, exigir reset de senha por canal separado.

#### [P4-B9] ⏸️ ACEITO — `securityService.js` (não auditado) — verificar se há mais utilities expostas
**Justificativa:** Recomendação para próxima passada (Pass 5). Sem evidência de vulnerabilidade concreta aqui.
- **Arquivo:** `src/services/securityService.js`
- **Descrição:** Não auditado em detalhe nesta passada. Recomendado leitura na próxima.

#### [P4-B10] ⏸️ ACEITO — `crossOriginResourcePolicy` não setado em helmet — default `same-origin` em helmet@7
**Justificativa:** Já validado limpo no próprio relatório original. Default do helmet 7 cobre o caso.
- **Arquivo:** `src/server.js:18`
- **Descrição:** Helmet 7 já aplica `Cross-Origin-Resource-Policy: same-origin` por default — confirmado limpo.

---

## Resumo

### Status pós-fixes (2026-05-11)
- **Críticos:** 4/4 ✅ FIXADOS (C1, C2, C3, C4)
- **Altos:** 7/7 ✅ FIXADOS (A1, A2, A3, A4, A5, A6, A7)
- **Médios:** 8/8 ✅ FIXADOS (M1–M8)
- **Baixos:** 3 ✅ FIXADOS (B5, B6, B8) + 7 ⏸️ ACEITOS com justificativa (B1, B2, B3, B4, B7, B9, B10)
- **Smoke tests:** 3/3 PASS (`jest --runInBand`, ~57s)
- **Commits:** 4 commits semânticos (criticals → high → medium → low), todos atômicos.

### Análise original abaixo

- **Pass 3 cleanup verificado:** M7 fixado, M6/B2/B7 aceitos com justificativa documentada.
- **Novos críticos:** **4**
  - P4-C1 **lateral movement** cliente→admin (ALTÍSSIMO IMPACTO — comprometimento total dos dados internos do salão a partir de uma conta de cliente do app).
  - P4-C2 bloqueios cross-tenant (INSERT e DELETE).
  - P4-C3 fidelidade adicionar pontos sem validação.
  - P4-C4 fidelidade resgatar race condition.
- **Novos altos:** **7** — venda-cancelar estoque cross-tenant, atendimento sem tenancy + valor arbitrário (criar e atualizar), configuracoes mass-assignment + info disclosure do filesystem, register sem rate limit por IP, AI command com `clienteId` forjável via prompt injection.
- **Novos médios:** **8** — jwt.verify sem algorithms, password reset URL hardcoded, notificacoes sem tenancy, WS sem maxPayload, Node 26 em dev/Render 18, sync.push 500 changes, login timing, parameter pollution.
- **Novos baixos:** **10** — diversos (secrets segregation, healthcheck pool, CORS credentials, WS type, log PII, backup senha_hash, etc.).

### Prioridades recomendadas

1. **🔴 Imediato:** **P4-C1** (lateral movement) — fix de 3 linhas em `authMiddleware`. Esta é a vulnerabilidade mais grave da auditoria toda; bloqueia escalada cliente→admin via JWT. **P4-C2** (bloqueios) e **P4-C3/C4** (fidelidade) também são fix de 1 sprint.
2. **🟠 Esta sprint:** P4-A1 (venda cancelar tenancy), P4-A2/A3 (atendimentos), P4-A4/A5 (configuracoes), P4-A7 (AI clienteId).
3. **🟡 Próxima sprint:** algorithms explícito em jwt.verify, password reset URL via env, WS maxPayload, login timing.
4. **🟢 Backlog:** segregação de secrets, hardening de CORS, redação de logs.

### Não encontrado / verificado limpo

- ✅ Deep links / scheme `softhair://` — não definido em `app.json`.
- ✅ WebView com `allowFileAccess` — não há WebView no mobile.
- ✅ JSON.parse de input sem catch — protegido por `JSON.parse` em `try` em todos os call sites.
- ✅ YAML/XML deserialization — não há `js-yaml`, `xml2js`, `node-serialize` em deps.
- ✅ `npm audit --omit=dev` — **0 vulnerabilidades** em deps de produção.
- ✅ `path traversal` em backup — gerado em memória, sem fs.write.
- ✅ Open redirect — `res.redirect` não usado em nenhuma rota.
- ✅ JWT `alg: none` — mitigado pelo default de `jsonwebtoken@9` (HS256 quando secret é string).
- ✅ JWT `iss/aud` — não usados (HS256 com mesmo issuer; ok para sistema fechado).
- ✅ JWT `kid` header injection — mesmo motivo (HS256, sem `jwks`).
- ✅ Trigger / view / schema misturado — apenas `public` schema, sem triggers.
- ✅ `ON DELETE CASCADE` — usado consistentemente em FK para `saloes(id)`; safe para tenant cleanup.
- ✅ Cache-Control em endpoints autenticados — não há headers de cache explícitos; default do Express é sem cache (ok). Sem CDN intermediário configurado.
- ✅ HTTP smuggling — Express não compõe com proxy custom; Render LB faz HTTP/1.1 terminado.
- ✅ Crypto: IV reuso — `encrypt()` usa `crypto.randomBytes(16)` por chamada. OK.
- ✅ ENCRYPTION_KEY trocado entre deploys — validado no boot (P3-M2); falha-fast em prod se inválido.
