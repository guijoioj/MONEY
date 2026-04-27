# src/services/ProfissionalService.js

**Repository:** Server
**File:** `src/services/ProfissionalService.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/services/ProfissionalService.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/profissionais|profissionais]]
- [[domains/servicos|servicos]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/mobile-ui|mobile-ui]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const Profissional = require('../models/Profissional');

class ProfissionalService {
  async listar(salaoId, filtros = {}) {
    try {
      const profissionalModel = new Profissional();
      const profissionais = await profissionalModel.findAll(filtros, salaoId);
      return {
        success: true,
        data: profissionais
      };
    } catch (error) {
      console.error('Erro ao listar profissionais:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async buscarPorId(id, salaoId) {
    try {
      const profissionalModel = new Profissional();
      const profissional = await profissionalModel.findById(id, salaoId);
      
      if (!profissional) {
        return {
          success: false,
          error: 'Profissional não encontrado'
        };
      }

      return {
        success: true,
        data: profissional
      };
    } catch (error) {
      console.error('Erro ao buscar profissional:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async criar(data, salaoId) {
    try {
      const profissionalModel = new Profissional();
      
      if (!data.nome) {
        throw new Error('Nome é obrigatório');
      }

      const profissional = await profissionalModel.create({
        ...data,
        salao_id: salaoId,
        ativo: data.ativo !== undefined ? data.ativo : true,
        comissao_percentual: data.comissao_percentual || 0
      });

      return {
        success: true,
        data: profissional
      };
    } catch (error) {
      console.error('Erro ao criar profissional:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async atualizar(id, data, salaoId) {
    try {
      const profissionalModel = new Profissional();
      
      const profissionalExistente = await profissionalModel.findById(id, salaoId);
      if (!profissionalExistente) {
        return {
          success: false,
          error: 'Profissional não encontrado'
        };
      }

      const profissional = await profissionalModel.update(id, data, salaoId);

      return {
        success: true,
        data: profissional
      };
    } catch (error) {
      console.error('Erro ao atualizar profissional:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deletar(id, salaoId) {
    try {
      const profissionalModel = new Profissional();
      
      const profissional = await profissionalModel.findById(id, salaoId);
      if (!profissional) {
        return {
          success: false,
          error: 'Profissional não encontrado'
        };
      }

      // Soft delete
      await profissionalModel.update(id, { ativo: false }, salaoId);

      return {
        success: true,
        message: 'Profissional removido com sucesso'
      };
    } catch (error) {
      console.error('Erro ao deletar profissional:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getServicos(profissionalId, salaoId) {
    try {
      const { query } = require('../config/database');
      
      const servicos = await query(`
        SELECT s.* FROM servicos s
        JOIN profissional_servicos ps ON ps.servico_id = s.id
        WHERE ps.profissional_id = $1 AND s.salao_id = $2 AND s.ativo = true
      `, [profissionalId, salaoId]);

      return {
        success: true,
        data: servicos
      };
    } catch (error) {
      console.error('Erro ao buscar servicos do profissional:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ProfissionalService;
```
