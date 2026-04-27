# src/services/CreditoService.js

**Repository:** Server
**File:** `src/services/CreditoService.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/services/CreditoService.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/clientes|clientes]]
- [[domains/vendas|vendas]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/mobile-ui|mobile-ui]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const { query, queryOne, withTransaction } = require('../config/database');

class CreditoService {
  async listarPorCliente(clienteId, salaoId) {
    try {
      // Verificar se cliente pertence ao salão
      const cliente = await queryOne(
        'SELECT id, nome, credito_disponivel FROM clientes WHERE id = $1 AND salao_id = $2',
        [clienteId, salaoId]
      );
      if (!cliente) return { success: false, error: 'Cliente não encontrado' };

      const historico = await query(
        'SELECT * FROM creditos_cliente WHERE cliente_id = $1 ORDER BY created_at DESC',
        [clienteId]
      );

      return {
        success: true,
        data: {
          cliente: { id: cliente.id, nome: cliente.nome, credito_disponivel: cliente.credito_disponivel },
          historico
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async adicionar(clienteId, valor, tipo, observacoes, salaoId) {
    try {
      return await withTransaction(async (client) => {
        // Buscar cliente e bloquear para atualização
        const clienteResult = await client.query(
          'SELECT id, credito_disponivel FROM clientes WHERE id = $1 AND salao_id = $2 FOR UPDATE',
          [clienteId, salaoId]
        );
        if (clienteResult.rows.length === 0) {
          throw new Error('Cliente não encontrado');
        }

        const clienteData = clienteResult.rows[0];
        const saldoAnterior = parseFloat(clienteData.credito_disponivel);
        const valorNumerico = parseFloat(valor);

        if (tipo === 'uso' && saldoAnterior < valorNumerico) {
          throw new Error('Saldo insuficiente');
        }

        const saldoNovo = tipo === 'uso'
          ? saldoAnterior - valorNumerico
          : saldoAnterior + valorNumerico;

        // Registrar movimentação
        const credito = await client.query(`
          INSERT INTO creditos_cliente (cliente_id, tipo, valor, saldo_anterior, saldo_novo, observacoes)
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `, [clienteId, tipo, valorNumerico, saldoAnterior, saldoNovo, observacoes || null]);

        // Atualizar saldo do cliente
        await client.query(
          'UPDATE clientes SET credito_disponivel = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [saldoNovo, clienteId]
        );

        return {
          success: true,
          data: credito.rows[0],
          message: `Crédito ${tipo === 'uso' ? 'utilizado' : 'adicionado'} com sucesso`
        };
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = CreditoService;
```
