# Audit Comissões — Estado Atual (snapshot 2026-05-19)

> Baseado em leitura completa de SOFT-HAIR-SERVER, SoftHair/backend, SoftHair/frontend.

## 1. Schema PostgreSQL (Render)

### Tabela `comissoes`
**Arquivo:** `SOFT-HAIR-SERVER/src/config/initDb.js`
```sql
CREATE TABLE comissoes (
  id SERIAL PRIMARY KEY,
  salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
  profissional_id INTEGER REFERENCES profissionais(id),
  venda_id INTEGER REFERENCES vendas(id) ON DELETE CASCADE,
  valor_total DECIMAL(10,2) NOT NULL,
  percentual DECIMAL(5,2) NOT NULL,
  valor_comissao DECIMAL(10,2) NOT NULL,
  pago BOOLEAN DEFAULT false,
  data_pagamento DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
**Problemas:**
- Sem índices (queries por status, profissional, período são full scan)
- `pago` boolean é simplista (não cobre cancelada/estornada/bloqueada)
- Sem `competencia` (mês de referência fica derivado de `created_at`)
- Sem `tipo_item` (não distingue serviço/produto/pacote)
- Sem `papel_profissional` (sem suporte a assistente/split)
- Sem snapshot da regra (mudar comissão_percentual do profissional altera histórico semanticamente)

### Tabela `comissoes_pagamentos`
**Arquivo:** mesma file
```sql
CREATE TABLE comissoes_pagamentos (
  id SERIAL PRIMARY KEY,
  salao_id INTEGER,
  profissional_id INTEGER,
  valor DECIMAL(10,2),
  data_pagamento DATE,
  observacoes TEXT,
  motivo_estorno TEXT,
  status VARCHAR(50) DEFAULT 'pago',
  created_at TIMESTAMP
);
```
**Problemas:**
- Unifica pagamentos e estornos no mesmo `status` (string livre)
- Sem `quantidade_comissoes` (n itens pagos no lote)
- Sem `periodo_inicio`/`periodo_fim`
- Sem `idempotency_key`

### Tabela `comissoes_estornos` (schema.sql, NÃO ativa)
**Arquivo:** `SOFT-HAIR-SERVER/src/migrations/reference/schema.sql`
Duplicação inconsistente (TEXT vs INTEGER). Não criada no initDb.

### Campos em tabelas dependentes
- `profissionais.comissao_percentual REAL DEFAULT 0` ✅
- `servicos.comissao_percentual REAL DEFAULT 0` ✅
- `produtos`: **sem campo de comissão**
- `vendas`: **sem campo de comissão**
- `atendimentos.auxiliarId TEXT` (campo existe mas não usado em comissão)

## 2. Backend Produção

### `ComissaoService.js`
Métodos:
- `listar(salaoId, filtros)` — LIMIT configurável, filtros: profissional, pago, data range
- `buscarPorId(id, salaoId)`
- `criar(data, salaoId)` — INSERT sem transação
- `marcarComoPaga(id, salaoId)` — UPDATE atômico individual
- `resumoPorProfissional(salaoId, id, dataInicio, dataFim)` — agregação

**Gaps:**
- Nenhuma geração automática
- Nenhuma validação de percentual range
- Nenhuma transação em `criar`
- Nenhum acesso a snapshot de regra

### `routes/comissoes.js` (265 linhas)
9 endpoints (vê design doc seção 6 pra lista).
- `POST /pagar` tem **transação ACID + idempotência + reconciliação** ✅
- `POST /estornar` cria registro mas **não vincula à comissão original** ❌
- Audit log presente em pagar/estornar/criar ✅

### `VendaService.js` / `AtendimentoService.js`
**Não geram comissões automaticamente.** Apenas leem em JOINs. Comissão é manual.

## 3. Frontend

### Telas atuais
- `Administrativo.jsx > ComissoesSection` (linhas 789+): tabs `resumo`, `pagar`, `pagas`, `estornar`
- `services/api.js`: exporta `comissoesAPI` com 4 métodos (getPagas, getEstornos, pagar, estornar)

### Gaps
- Sem tela de **regras** (configuração só edita `comissao_percentual` flat)
- Sem **extrato/holerite** por profissional
- Sem **simulador**
- Sem **dashboard** consolidado
- Sem visualização de detalhe (qual venda, qual item, qual regra)
- Sem suporte a ajustes (bônus, adiantamento)

## 4. Backend Electron Embarcado

### Schema SQLite
**Confirmação:** sem tabela `comissoes`. Campo `comissao_percentual` em profissionais/servicos existe mas não é consumido.

### Routes
**Confirmação:** `server.js` define stub que retorna `[]` pra `/api/comissoes`. Sem CRUD real.

### Sync
**Confirmação:** `comissoes` NÃO está em `SYNC_TABLES` no `syncService.js`. Não sincroniza.

## 5. Gaps críticos priorizados

| Gap | Impacto | Prioridade |
|-----|---------|------------|
| Comissão não gerada automaticamente | Erros de cálculo, esquecimento humano | CRÍTICO |
| Sem snapshot de regra | Mudar % global muda passado | CRÍTICO |
| Sem float-safety (DECIMAL ok mas conversão JS pode quebrar) | Erros financeiros | ALTO |
| Sem hierarquia de regras | Inflexível pra realidade do salão | ALTO |
| Sem split/assistente | Limita modelo de operação | ALTO |
| Sem meta escalonada | Falta motivacional | MÉDIO |
| Sem comissão de produto | Perde receita | MÉDIO |
| Electron stub | Cliente desktop sem feature | MÉDIO (cobre com arch B) |
| Sem extrato/holerite | UX ruim pro profissional | ALTO |
| Sem ajustes (bônus/adiantamento) | Operação manual no Excel | ALTO |
| Sem idempotência | Risco de duplicação | ALTO |
| Auditoria parcial | Compliance limitado | MÉDIO |

## 6. Arquivos que mudarão

Ver design doc seção 11 e checklist seção 13.

## 7. Conclusão

Módulo atual entrega **5/10** do que sistemas profissionais (Avec/HBS) entregam.
Reescrita necessária. Plano em `COMISSOES-V2-DESIGN.md`.
