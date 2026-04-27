# src/services/VendaService.js

**Repository:** Server
**File:** `src/services/VendaService.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/services/VendaService.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/produtos|produtos]]
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

class VendaService {
  async listar(salaoId, filtros = {}) {
    try {
      let sql = `
        SELECT v.*, c.nome as cliente_nome, p.nome as profissional_nome
        FROM vendas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        LEFT JOIN profissionais p ON p.id = v.profissional_id
        WHERE v.salao_id = $1
      `;
      const params = [salaoId];
      let paramCount = 2;

      if (filtros.status) {
        sql += ` AND v.status = $${paramCount++}`;
        params.push(filtros.status);
      }
      if (filtros.tipo) {
        sql += ` AND v.tipo = $${paramCount++}`;
        params.push(filtros.tipo);
      }
      if (filtros.data_inicio && filtros.data_fim) {
        sql += ` AND DATE(v.created_at) BETWEEN $${paramCount++} AND $${paramCount++}`;
        params.push(filtros.data_inicio, filtros.data_fim);
      }

      sql += ' ORDER BY v.created_at DESC';
      const data = await query(sql, params);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async buscarPorId(id, salaoId) {
    try {
      const venda = await queryOne(`
        SELECT v.*, c.nome as cliente_nome, p.nome as profissional_nome
        FROM vendas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        LEFT JOIN profissionais p ON p.id = v.profissional_id
        WHERE v.id = $1 AND v.salao_id = $2
      `, [id, salaoId]);

      if (!venda) return { success: false, error: 'Venda não encontrada' };

      // Buscar itens da venda
      const itens = await query(
        'SELECT vi.*, pr.nome as produto_nome FROM venda_itens vi LEFT JOIN produtos pr ON pr.id = vi.produto_id WHERE vi.venda_id = $1',
        [id]
      );
      venda.itens = itens;

      return { success: true, data: venda };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async criar(data, salaoId) {
    try {
      return await withTransaction(async (client) => {
        // Criar venda
        const vendaResult = await client.query(`
          INSERT INTO vendas (cliente_id, profissional_id, tipo, status, valor_total, desconto, valor_final, forma_pagamento, observacoes, salao_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
        `, [
          data.cliente_id || null, data.profissional_id || null,
          data.tipo, data.status || 'pendente',
          data.valor_total, data.desconto || 0, data.valor_final,
          data.forma_pagamento || null, data.observacoes || null, salaoId
        ]);
        const venda = vendaResult.rows[0];

        // Criar itens se existirem
        if (data.itens && Array.isArray(data.itens)) {
          for (const item of data.itens) {
            await client.query(`
              INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario, valor_total)
              VALUES ($1, $2, $3, $4, $5)
            `, [venda.id, item.produto_id, item.quantidade, item.preco_unitario,
                item.quantidade * item.preco_unitario]);
          }
        }

        return { success: true, data: venda };
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async atualizar(id, data, salaoId) {
    try {
      const result = await queryOne(`
        UPDATE vendas SET
          status = COALESCE($1, status),
          forma_pagamento = COALESCE($2, forma_pagamento),
          observacoes = COALESCE($3, observacoes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND salao_id = $5 RETURNING *
      `, [data.status, data.forma_pagamento, data.observacoes, id, salaoId]);

      if (!result) return { success: false, error: 'Venda não encontrada' };
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async cancelar(id, salaoId) {
    try {
      const result = await queryOne(`
        UPDATE vendas SET status = 'cancelada', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND salao_id = $2 RETURNING *
      `, [id, salaoId]);

      if (!result) return { success: false, error: 'Venda não encontrada' };
      return { success: true, data: result, message: 'Venda cancelada' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = VendaService;
```
