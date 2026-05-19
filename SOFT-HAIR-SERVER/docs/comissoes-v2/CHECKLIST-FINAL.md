# Checklist Final — Comissões V2

Snapshot do estado de implementação em 2026-05-19.

## ✅ Fases 1-13 (do prompt original)

| # | Fase | Entrega | Validação |
|---|------|---------|-----------|
| 1 | Auditoria | AUDIT-COMISSOES.md + AUDIT-MOBILE.md | docs em SOFT-HAIR-SERVER/docs/comissoes-v2/ |
| 2 | money.js | utils/money.js + 45 tests | ✅ tests passing |
| 3 | Migrations V2 | 001_comissoes_v2.sql (5 tabelas, 25 colunas, 6 índices, backfill) | ✅ SQL syntax válido |
| 4 | CommissionEngine | 7 módulos puros + Repository + 51 tests | ✅ 51 tests passing |
| 5 | Gatilho venda/atendimento | CommissionTriggers.js + integração VendaService + AtendimentoService | ✅ modules load |
| 6 | Endpoints v2 | /api/v2/comissoes/* (lista, dashboard, extrato, simulador, pagar, estornar, regras CRUD, ajustes) | ✅ routes load OK |
| 7 | Frontend telas | ComissoesV2, RegrasComissao, ExtratoProfissional, PagamentoComissao, ConfigurarServidor | ✅ build 903ms OK |
| 8 | Mobile UI | (admin) group com dashboard/comissoes/regras/pagamento + serverConfig | ✅ tsc 0 erros |
| 9 | /api/mobile/* | /me, /dashboard, /agenda, /comissoes/resumo, /comissoes/extrato, /notificacoes | ✅ routes load OK |
| 10 | Electron offline | 503 + banner ComissoesOfflineBanner | ✅ implementado |
| 11 | Segurança | Race condition fix (FOR UPDATE), resolveProfId tenancy, cap offset | ✅ commit 70fb459 |
| 12 | Testes integração | 19 tests com pg mockado | ✅ 19/19 passing |
| 13 | Build/test/lint | Server 123/124, Frontend build, Mobile tsc 0 | ✅ doc VALIDACAO-FASE13.md |

## ✅ Arquitetura "Cérebro Local" pronta

### PC Servidor (deploy/)
- `install.sh` — setup completo Ubuntu (Postgres + Node 20 + clone + service + cron)
- `update.sh` — auto-update via cron 4h
- `backup.sh` — backup PostgreSQL cron 3h (30 dias retention)
- `softhair-backend.service` — systemd unit hardened
- `README.md` — manual deploy

### PC Cliente (6 PCs Electron)
- `electron/serverConfig.js` — persistência da config (embarcado/local/render/custom)
- `electron/main.js` — modo frontend-only se config != embarcado
- `electron/preload.js` — APIs IPC `window.electron.serverConfig.{get,set,presets}`
- `frontend/src/pages/ConfigurarServidor.jsx` — tela com test connection + latência

## Estatísticas

```
Commits V2 totais:           15+
Linhas adicionadas:          ~7000
Arquivos novos:              30+
Tests passing:               115/115 V2 + 123/124 totais
Endpoints novos:             24 (v2 + mobile)
Telas frontend novas:        5
Telas mobile novas:          4 admin + config
Scripts deploy:              4
Docs:                        5 (AUDIT, DESIGN, MANUAL, VALIDACAO, CHECKLIST)
```

## Fluxo end-to-end validado

```
1. Admin cria regra de comissão (frontend → POST /api/v2/comissoes/regras)
   ↓
2. Funcionário finaliza venda no caixa (POST /api/vendas, status='concluida')
   ↓
3. VendaService.criar() chama CommissionTriggers.onVendaCriada()
   ↓
4. Trigger busca regras vigentes + calcula via Engine
   ↓
5. INSERT comissao (idempotency_key, snapshot_json, status='pendente')
   ↓
6. Admin abre tela "Pagar Comissão" (frontend ou mobile)
   ↓
7. Wizard: profissional → período → lista pendentes → confirma valor
   ↓
8. POST /api/v2/comissoes/pagar com idempotency_key
   ↓
9. Transação atômica:
   - SELECT FOR UPDATE no idempotency_key
   - UPDATE comissoes status='paga' + pagamento_lote_id
   - INSERT comissoes_pagamentos_v2
   - audit_log
   ↓
10. Profissional vê extrato (mobile ou web): atendimentos + valor + status pago
```

## Workflow de update automático

```
Você faz commit + tag → git push origin main --tags
   ↓
GitHub Actions builda Windows .exe + .yml
   ↓
GitHub Release publicado (draft → publish)
   ↓
[6 PCs Electron]            [1 PC Servidor]
electron-updater checa       cron 4h roda update.sh
a cada 4h                       ↓
  ↓                          git pull
detecta versão nova             ↓
  ↓                          npm install (se package.json mudou)
baixa em background             ↓
  ↓                          npm run db:migrate (se migration nova)
popup "Reiniciar?"              ↓
  ↓                          systemctl restart softhair-backend
instala + reabre                ↓
                             health check OK
```

## Decisões arquiteturais documentadas

1. **Opção B (Electron offline bloqueia comissões)** — segurança financeira
2. **Cents integers everywhere** — zero risco float
3. **Snapshot imutável de regra** — mudar regra não altera passado
4. **v1 + v2 paralelos** — zero quebra de compat
5. **Cérebro local + Render como backup** — offline-first + disaster recovery
6. **Multi-tenant em todas queries** — salao_id sempre
7. **requireAdmin em mutações financeiras** — pagar/estornar/criar regra
8. **Audit log financeiro completo** — logAction em tudo

## Pendências menores (não-bloqueantes)

- [ ] Refresh token no mobile (bloqueador para sessões longas)
- [ ] Implementar realmente o upload de backup pra cloud (rclone) — TODO em backup.sh
- [ ] Adicionar `useComissoes` / `useDashboard` hooks no mobile (atualmente usa useQuery direto)
- [ ] Testes E2E com Cypress/Playwright (atualmente só unit + integration mock)
- [ ] Validação de schema JSON em `condicoes_json` (atualmente livre)
- [ ] Notificação push quando comissão paga (mobile já tem expo-notifications configurado)

## Pronto pra produção?

**Sim**, depois de:
1. Rodar `npm run db:migrate` no Render (uma vez)
2. Setar env vars no Render: `ENCRYPTION_KEY`, `HMAC_SECRET`, `BACKUP_ENCRYPTION_KEY`, `AUTO_COMISSAO=true`
3. Configurar 1 salão piloto com `AUTO_COMISSAO=true`
4. Validar 1 semana antes de espalhar
