# src/services/index.js

**Repository:** Server
**File:** `src/services/index.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/services/index.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/servicos|servicos]]
- [[domains/produtos|produtos]]
- [[domains/vendas|vendas]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const ClienteService = require('./ClienteService');
const ProfissionalService = require('./ProfissionalService');
const ServicoService = require('./ServicoService');
const ProdutoService = require('./ProdutoService');
const AgendamentoService = require('./AgendamentoService');
const VendaService = require('./VendaService');
const AtendimentoService = require('./AtendimentoService');
const ComissaoService = require('./ComissaoService');
const FechamentoService = require('./FechamentoService');
const CreditoService = require('./CreditoService');
const NotificacaoService = require('./NotificacaoService');
const BackupService = require('./BackupService');

module.exports = {
  ClienteService,
  ProfissionalService,
  ServicoService,
  ProdutoService,
  AgendamentoService,
  VendaService,
  AtendimentoService,
  ComissaoService,
  FechamentoService,
  CreditoService,
  NotificacaoService,
  BackupService,
};
```
