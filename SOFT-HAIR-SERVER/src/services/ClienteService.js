const Cliente = require('../models/Cliente');

class ClienteService {
  async listar(salaoId, filtros = {}, options = {}) {
    try {
      const { query } = require('../config/database');
      const limit = Math.min(parseInt(options.limit) || 100, 100);
      const offset = Math.max(parseInt(options.offset) || 0, 0);

      // Extrair termo de busca especial antes de montar filtros SQL
      const searchTerm = filtros._search || null;
      const ativo = filtros.ativo;

      let conditions = ['salao_id = $1'];
      let params = [salaoId];
      let paramCount = 2;

      if (ativo !== undefined) {
        conditions.push(`ativo = $${paramCount++}`);
        params.push(ativo);
      }

      if (searchTerm) {
        conditions.push(`(nome ILIKE $${paramCount} OR telefone ILIKE $${paramCount} OR email ILIKE $${paramCount})`);
        params.push(`%${searchTerm}%`);
        paramCount++;
      }

      const where = conditions.join(' AND ');

      // Contar total
      const countResult = await query(`SELECT COUNT(*) FROM clientes WHERE ${where}`, params);
      const total = parseInt(countResult.rows ? countResult.rows[0].count : countResult[0].count);

      // Buscar página
      const rows = await query(
        `SELECT * FROM clientes WHERE ${where} ORDER BY nome ASC LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
        [...params, limit, offset]
      );

      const data = rows.rows || rows;

      return {
        success: true,
        data: {
          data,
          total,
          page: Math.floor(offset / limit) + 1,
          limit,
          totalPages: Math.ceil(total / limit),
        }
      };
    } catch (error) {
      console.error('Erro ao listar clientes:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async buscarPorId(id, salaoId) {
    try {
      const clienteModel = new Cliente();
      const cliente = await clienteModel.findById(id, salaoId);
      
      if (!cliente) {
        return {
          success: false,
          error: 'Cliente não encontrado'
        };
      }

      return {
        success: true,
        data: cliente
      };
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async criar(data, salaoId) {
    try {
      const clienteModel = new Cliente();
      
      // Validações básicas
      if (!data.nome) {
        throw new Error('Nome é obrigatório');
      }

      // Criar cliente
      const cliente = await clienteModel.create({
        ...data,
        salao_id: salaoId,
        credito_disponivel: data.credito_disponivel || 0,
        ativo: data.ativo !== undefined ? data.ativo : true
      });

      return {
        success: true,
        data: cliente
      };
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async atualizar(id, data, salaoId) {
    try {
      const clienteModel = new Cliente();
      
      // Verificar se cliente existe
      const clienteExistente = await clienteModel.findById(id, salaoId);
      if (!clienteExistente) {
        return {
          success: false,
          error: 'Cliente não encontrado'
        };
      }

      // Atualizar cliente
      const cliente = await clienteModel.update(id, data, salaoId);

      return {
        success: true,
        data: cliente
      };
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deletar(id, salaoId) {
    try {
      const clienteModel = new Cliente();
      
      // Verificar se cliente existe
      const cliente = await clienteModel.findById(id, salaoId);
      if (!cliente) {
        return {
          success: false,
          error: 'Cliente não encontrado'
        };
      }

      // Soft delete (marcar como inativo)
      await clienteModel.update(id, { ativo: false }, salaoId);

      return {
        success: true,
        message: 'Cliente removido com sucesso'
      };
    } catch (error) {
      console.error('Erro ao deletar cliente:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async adicionarCredito(clienteId, valor, salaoId) {
    try {
      const clienteModel = new Cliente();
      
      const cliente = await clienteModel.findById(clienteId, salaoId);
      if (!cliente) {
        return {
          success: false,
          error: 'Cliente não encontrado'
        };
      }

      // Atualizar crédito
      const novoCredito = parseFloat(cliente.credito_disponivel) + parseFloat(valor);
      await clienteModel.update(clienteId, { 
        credito_disponivel: novoCredito 
      }, salaoId);

      return {
        success: true,
        data: { credito_disponivel: novoCredito },
        message: 'Crédito adicionado com sucesso'
      };
    } catch (error) {
      console.error('Erro ao adicionar crédito:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async buscarPorTermo(termo, salaoId, limit = 50) {
    try {
      const clienteModel = new Cliente();
      const { query } = require('../config/database');
      
      const clientes = await query(`
        SELECT * FROM clientes 
        WHERE salao_id = $1 
        AND ativo = true 
        AND (nome ILIKE $2 OR telefone ILIKE $2 OR email ILIKE $2) 
        ORDER BY nome 
        LIMIT $3
      `, [salaoId, `%${termo}%`, limit]);

      return {
        success: true,
        data: clientes
      };
    } catch (error) {
      console.error('Erro ao buscar clientes por termo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ClienteService;