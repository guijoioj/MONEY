# Auditoria de Continuidade MONEY

Data: 2026-04-30

## Escopo executado

- Backend `SOFT-HAIR-SERVER/`
- Comparacao estatica de codigo versus schema real do PostgreSQL `db_softhair`
- Correcoes aplicadas apenas em pontos montados/ativos ou models reais com colunas inexistentes

## Correcoes aplicadas

1. `SOFT-HAIR-SERVER/src/routes/appProfissional.js`
   - `data_agendamento`/`hora_agendamento` trocados por `data_hora`.
   - Consulta de comissoes trocada de coluna inexistente `data` para `created_at`.
   - Finalizacao de atendimento deixou de usar `ON CONFLICT (agendamento_id)`, pois nao ha constraint unica no schema real.
   - Removida escrita em `historico_clientes`, tabela inexistente no banco real.

2. `SOFT-HAIR-SERVER/src/models/Servico.js`
   - `data_agendamento` trocado por `data_hora`.
   - `duracao` trocado por `duracao_minutos`.
   - Removido filtro por `categoria`, coluna inexistente em `servicos`.

3. `SOFT-HAIR-SERVER/src/models/Profissional.js`
   - Disponibilidade agora usa `data_hora` e `duracao_minutos`.
   - Resumo de comissoes agora usa `valor_total`, `valor_comissao`, `created_at` e `pago`.

4. Correcao completa da divergencia encontrada depois da auditoria inicial
   - Criado `src/middleware/appAuth.js`.
   - Criados `src/models/Fechamento.js` e `src/models/User.js`.
   - Criados aliases/servicos faltantes `src/services/backupService.js` e `src/services/securityService.js`.
   - Removido `src/services/bootstrapService.js`.
   - Convertidos models legados de `?`/camelCase para PostgreSQL/snake_case: `ClienteApp`, `PedidoAgendamento`, `PedidoLoja`, `PontoRegistro`, `CreditoCliente`, `ClienteHistorico`, `ComissaoPaga`, `ComissaoEstorno`.
   - Rotas app legadas ajustadas para `salao_id`, `preco_venda`, `usuarios`, `venda_itens` e campos reais.
   - `server.js` passou a montar `/api/app/cliente`, `/api/app/pedidos` e `/api/app/loja`.
   - `initDb.js` cria as tabelas e migrations idempotentes esperadas.
   - Banco PostgreSQL real recebeu as migrations idempotentes.
   - `server.js` passou a montar `/api/configuracoes` e `/api/historico`, encontrados por smoke test.
   - `ProdutoService.criar()` passou a aceitar `preco_venda` alem de `preco`.
   - `ProdutoService.estoqueBaixo()` foi adicionado como alias para a rota `/api/produtos/estoque-baixo`.

## Achados principais

### P0 - Imports quebrados em codigo legado/app nao montado

Status: corrigido.

- `src/routes/app/auth.js`: `../models/User`
- `src/routes/app/cliente.js`: `../../middleware/appAuth`, `../../models/Fechamento`
- `src/routes/app/loja.js`: `../../middleware/appAuth`
- `src/routes/app/pedidos.js`: `../../middleware/appAuth`
- `src/routes/app/profissional.js`: `../../models/Fechamento`, `../../middleware/appAuth`
- `src/routes/app/security.js`: `../../services/securityService`
- `src/services/bootstrapService.js`: `../models/User`
- `src/scripts/createAdmin.js`: `../models/User`

As rotas app antigas agora carregam sem imports quebrados, e as rotas app de cliente/pedidos/loja estao montadas.

### P1 - Codigo ainda incompatível com PostgreSQL/schema real

Status: corrigido nos arquivos auditados.

- `src/models/ClienteApp.js`
- `src/models/PedidoAgendamento.js`
- `src/models/PedidoLoja.js`
- `src/models/PontoRegistro.js`
- `src/models/CreditoCliente.js`
- `src/models/ComissaoPaga.js`
- `src/models/ComissaoEstorno.js`
- `src/models/ClienteHistorico.js`
- `src/routes/app/*`
- `src/routes/configuracoes.js`
- `src/routes/historico.js`
- `src/services/bootstrapService.js`

As tabelas novas verificadas no banco real apos migration: `clientes_app`, `comissoes_pagamentos`, `configuracoes`, `pedido_loja_itens`, `pedidos_agendamento`, `pedidos_loja`, `registros_ponto`.

### P1 - Divergencia entre prompt e estado real

Status: corrigido.

### P2/P3 - Pontos de atencao restantes

- `server.js` usa limite geral default de 500 req/15min.
- `src/services/ProfissionalService.js#getServicos()` foi ajustado para o schema real, sem `profissional_servicos`.
- `src/routes/appProfissional.js` foi revisado contra o schema para os campos que quebravam execução.

## Validacao executada

- `node -c src/routes/appProfissional.js`
- `node -c src/models/Servico.js`
- `node -c src/models/Profissional.js`
- Consulta ao `information_schema.columns` do PostgreSQL real.
- `node -c` em todos os arquivos `src/**/*.js`.
- `require()` de todos os arquivos em `src/models`, `src/middleware`, `src/routes` e `src/services`.
- Busca estatica por remanescentes de `?`, camelCase SQL, tabelas fantasma e colunas inexistentes citadas na auditoria.
- `initDb()` e `runMigrations()` executados contra o PostgreSQL real.
- `npm test -- --runInBand` nao executou porque `jest` nao esta instalado em `node_modules`.
- Smoke test HTTP contra servidor local e PostgreSQL real: 35/35 checks passaram.
  - Incluiu health, registro/login admin, `auth/me`, salao, configuracoes, clientes, historico, creditos, profissionais, servicos, produtos, estoque baixo, vendas, comissoes, notificacoes, sync e rotas app basicas.
- Suite Jest adicionada em `SOFT-HAIR-SERVER/src/__tests__/integration.smoke.test.js`.
  - Usa dados temporarios com prefixo `jest-smoke-*`.
  - Sobe o backend em porta isolada.
  - Executa cleanup no fim.
  - `npm test -- --runInBand` passou: 1 suite, 1 teste.
  - Verificacao posterior no banco atual confirmou `0` registros temporarios restantes em `saloes`, `usuarios`, `clientes`, `profissionais`, `servicos`, `produtos` e `clientes_app`.
