# src/services/ProdutoService.js

**Repository:** Server
**File:** `src/services/ProdutoService.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/services/ProdutoService.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/produtos|produtos]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/mobile-ui|mobile-ui]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const Produto = require('../models/Produto');

class ProdutoService {
  async listar(salaoId, filtros = {}) {
    try {
      const produtoModel = new Produto();
      const produtos = await produtoModel.findAll(filtros, salaoId);
      
      return {
        success: true,
        data: produtos
      };
    } catch (error) {
      console.error('Erro ao listar produtos:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async buscarPorId(id, salaoId) {
    try {
      const produtoModel = new Produto();
      const produto = await produtoModel.findById(id, salaoId);
      
      if (!produto) {
        return {
          success: false,
          error: 'Produto não encontrado'
        };
      }

      return {
        success: true,
        data: produto
      };
    } catch (error) {
      console.error('Erro ao buscar produto:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async criar(data, salaoId) {
    try {
      const produtoModel = new Produto();
      
      if (!data.nome) {
        throw new Error('Nome é obrigatório');
      }
      
      if (!data.preco) {
        throw new Error('Preço é obrigatório');
      }

      const produto = await produtoModel.create({
        ...data,
        salao_id: salaoId,
        ativo: data.ativo !== undefined ? data.ativo : true,
        quantidade: data.quantidade || 0,
        quantidade_minima: data.quantidade_minima || 0
      });

      return {
        success: true,
        data: produto
      };
    } catch (error) {
      console.error('Erro ao criar produto:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async atualizar(id, data, salaoId) {
    try {
      const produtoModel = new Produto();
      
      const produtoExistente = await produtoModel.findById(id, salaoId);
      if (!produtoExistente) {
        return {
          success: false,
          error: 'Produto não encontrado'
        };
      }

      const produto = await produtoModel.update(id, data, salaoId);

      return {
        success: true,
        data: produto
      };
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async atualizarEstoque(id, quantidade, tipo, salaoId) {
    try {
      const produtoModel = new Produto();
      
      const produto = await produtoModel.findById(id, salaoId);
      if (!produto) {
        return {
          success: false,
          error: 'Produto não encontrado'
        };
      }

      const qtdAnterior = parseInt(produto.quantidade);
      const qtdNueva = tipo === 'entrada' ? 
        qtdAnterior + quantidade : 
        qtdAnterior - quantidade;

      await produtoModel.update(id, { quantidade: qtdNueva }, salaoId);

      return {
        success: true,
        message: `Estoque atualizado. De ${qtdAnterior} para ${qtdNueva}`
      };
    } catch (error) {
      console.error('Erro ao atualizar estoque:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async produtosEmFalta(salaoId) {
    try {
      const { query } = require('../config/database');
      
      const produtos = await query(`
        SELECT * FROM produtos 
        WHERE salao_id = $1 
        AND ativo = true 
        AND quantidade <= quantidade_minima
        ORDER BY nome
      `, [salaoId]);

      return {
        success: true,
        data: produtos
      };
    } catch (error) {
      console.error('Erro ao buscar produtos em falta:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async buscarPorTermo(termo, salaoId) {
    try {
      const { query } = require('../config/database');
      
      const produtos = await query(`
        SELECT * FROM produtos 
        WHERE salao_id = $1 
        AND ativo = true 
        AND (nome ILIKE $2 OR descricao ILIKE $2)
        ORDER BY nome
      `, [salaoId, `%${termo}%`]);

      return {
        success: true,
        data: produtos
      };
    } catch (error) {
      console.error('Erro ao buscar produtos por termo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ProdutoService;
```
