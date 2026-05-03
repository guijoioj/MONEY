const Servico = require('../models/Servico');

class ServicoService {
  async listar(salaoId, filtros = {}) {
    try {
      const servicoModel = new Servico();
      const servicos = await servicoModel.findAll(filtros, salaoId);
      
      return {
        success: true,
        data: servicos
      };
    } catch (error) {
      console.error('Erro ao listar serviços:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async buscarPorId(id, salaoId) {
    try {
      const servicoModel = new Servico();
      const servico = await servicoModel.findById(id, salaoId);
      
      if (!servico) {
        return {
          success: false,
          error: 'Serviço não encontrado'
        };
      }

      return {
        success: true,
        data: servico
      };
    } catch (error) {
      console.error('Erro ao buscar serviço:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async criar(data, salaoId) {
    try {
      const servicoModel = new Servico();
      
      if (!data.nome) {
        throw new Error('Nome é obrigatório');
      }
      
      if (!data.preco) {
        throw new Error('Preço é obrigatório');
      }

      const servico = await servicoModel.create({
        ...data,
        salao_id: salaoId,
        ativo: data.ativo !== undefined ? data.ativo : true,
        comissao_percentual: data.comissao_percentual || 0
      });

      return {
        success: true,
        data: servico
      };
    } catch (error) {
      console.error('Erro ao criar serviço:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async atualizar(id, data, salaoId) {
    try {
      const servicoModel = new Servico();
      
      const servicoExistente = await servicoModel.findById(id, salaoId);
      if (!servicoExistente) {
        return {
          success: false,
          error: 'Serviço não encontrado'
        };
      }

      const servico = await servicoModel.update(id, data, salaoId);

      return {
        success: true,
        data: servico
      };
    } catch (error) {
      console.error('Erro ao atualizar serviço:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deletar(id, salaoId) {
    try {
      const servicoModel = new Servico();
      
      const servico = await servicoModel.findById(id, salaoId);
      if (!servico) {
        return {
          success: false,
          error: 'Serviço não encontrado'
        };
      }

      const { query } = require('../config/database');
      await query(`DELETE FROM servicos WHERE id = $1 AND salao_id = $2`, [id, salaoId]);

      return {
        success: true,
        message: 'Serviço removido com sucesso'
      };
    } catch (error) {
      console.error('Erro ao deletar serviço:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async buscarPorTermo(termo, salaoId) {
    try {
      const { query } = require('../config/database');
      
      const servicos = await query(`
        SELECT * FROM servicos 
        WHERE salao_id = $1 
        AND ativo = true 
        AND (nome ILIKE $2 OR descricao ILIKE $2)
        ORDER BY nome
      `, [salaoId, `%${termo}%`]);

      return {
        success: true,
        data: servicos
      };
    } catch (error) {
      console.error('Erro ao buscar serviços por termo:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ServicoService;