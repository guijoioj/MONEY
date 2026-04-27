# src/models/index.js

**Repository:** Server
**File:** `src/models/index.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/models/index.js` do repositório Server.

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
- [[domains/saloes|saloes]]
- [[domains/api|api]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
// Models do SoftHair Server
const BaseModel = require('./BaseModel');
const Usuario = require('./Usuario');
const Salao = require('./Salao');
const Cliente = require('./Cliente');
const Profissional = require('./Profissional');
const Servico = require('./Servico');
const Produto = require('./Produto');
const Venda = require('./Venda');
const Atendimento = require('./Atendimento');
const Agendamento = require('./Agendamento');
const Comissao = require('./Comissao');

module.exports = {
  BaseModel,
  Usuario,
  Salao,
  Cliente,
  Profissional,
  Servico,
  Produto,
  Venda,
  Atendimento,
  Agendamento,
  Comissao
};
```
