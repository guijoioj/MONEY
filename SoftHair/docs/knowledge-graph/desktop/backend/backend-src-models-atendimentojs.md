# backend/src/models/Atendimento.js

**Repository:** Desktop
**File:** `backend/src/models/Atendimento.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/models/Atendimento.js` do repositório Desktop.

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
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/mobile-ui|mobile-ui]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryRun, withTransaction, clientQuery, clientQueryOne, clientQueryRun } = require('../config/database');

class Atendimento {
  static async create(data, itensProdutos, itensServicos, salonId) {
    return withTransaction(async (client) => {
      const id = uuidv4();
      await clientQueryRun(client,
        `INSERT INTO atendimentos (id,"clienteId","profissionalId","auxiliarId",data,"horaInicio","horaFim",desconto,observacoes,"totalProdutos","totalServicos","totalGeral","formaPagamento","salonId")
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id,data.clienteId||null,data.profissionalId||null,data.auxiliarId||null,
         data.data||new Date().toISOString().split('T')[0],
         data.horaInicio||null,data.horaFim||null,data.desconto||0,data.observacoes||null,
         data.totalProdutos||0,data.totalServicos||0,data.totalGeral||0,data.formaPagamento||null,salonId]
      );
      if (itensProdutos?.length) {
        for (const item of itensProdutos) {
          await clientQueryRun(client,
            'INSERT INTO atendimentos_produtos (id,"atendimentoId","produtoId","quantidadeUsada",unidade,"precoUnitario",subtotal) VALUES (?,?,?,?,?,?,?)',
            [uuidv4(),id,item.produtoId,item.quantidadeUsada,item.unidade||'unidade',item.precoUnitario,item.subtotal]
          );
          if (item.quantidadeUsada > 0) await clientQueryRun(client, 'UPDATE produtos SET estoque=estoque-?,"updatedAt"=NOW() WHERE id=? AND "salonId"=?', [item.quantidadeUsada,item.produtoId,salonId]);
        }
      }
      if (itensServicos?.length) {
        for (const item of itensServicos) {
          await clientQueryRun(client,
            'INSERT INTO atendimentos_servicos (id,"atendimentoId","servicoId","horaInicio","horaFim",preco,duracao) VALUES (?,?,?,?,?,?,?)',
            [uuidv4(),id,item.servicoId,item.horaInicio,item.horaFim,item.preco,item.duracao]
          );
        }
      }
      return Atendimento._findByIdClient(client, id, salonId);
    });
  }

  static async _findByIdClient(client, id, salonId) {
    const a = await clientQueryOne(client, `
      SELECT a.*,c.nome as "clienteNome",c.telefone as "clienteTelefone",
             p.nome as "profissionalNome",p.comissao as "profissionalComissao",a2.nome as "auxiliarNome"
      FROM atendimentos a LEFT JOIN clientes c ON a."clienteId"=c.id
      LEFT JOIN profissionais p ON a."profissionalId"=p.id LEFT JOIN profissionais a2 ON a."auxiliarId"=a2.id
      WHERE a.id=? AND a."salonId"=?`, [id,salonId]);
    if (!a) return null;
    a.produtos = await clientQuery(client, `SELECT ap.*,p.nome as "produtoNome" FROM atendimentos_produtos ap LEFT JOIN produtos p ON ap."produtoId"=p.id WHERE ap."atendimentoId"=?`, [id]);
    a.servicos = await clientQuery(client, `SELECT as2.*,s.nome as "servicoNome" FROM atendimentos_servicos as2 LEFT JOIN servicos s ON as2."servicoId"=s.id WHERE as2."atendimentoId"=?`, [id]);
    return a;
  }

  static async findById(id, salonId) {
    const a = await queryOne(`
      SELECT a.*,c.nome as "clienteNome",c.telefone as "clienteTelefone",
             p.nome as "profissionalNome",p.comissao as "profissionalComissao",a2.nome as "auxiliarNome"
      FROM atendimentos a LEFT JOIN clientes c ON a."clienteId"=c.id
      LEFT JOIN profissionais p ON a."profissionalId"=p.id LEFT JOIN profissionais a2 ON a."auxiliarId"=a2.id
      WHERE a.id=? AND a."salonId"=?`, [id,salonId]);
    if (!a) return null;
    a.produtos = await query(`SELECT ap.*,p.nome as "produtoNome" FROM atendimentos_produtos ap LEFT JOIN produtos p ON ap."produtoId"=p.id WHERE ap."atendimentoId"=?`, [id]);
    a.servicos = await query(`SELECT as2.*,s.nome as "servicoNome" FROM atendimentos_servicos as2 LEFT JOIN servicos s ON as2."servicoId"=s.id WHERE as2."atendimentoId"=?`, [id]);
    return a;
  }

  static async getAll(filters = {}, salonId) {
    let sql = `SELECT a.*,c.nome as "clienteNome",p.nome as "profissionalNome",a2.nome as "auxiliarNome"
      FROM atendimentos a LEFT JOIN clientes c ON a."clienteId"=c.id
      LEFT JOIN profissionais p ON a."profissionalId"=p.id LEFT JOIN profissionais a2 ON a."auxiliarId"=a2.id
      WHERE a."salonId"=?`;
    const params = [salonId];
    if (filters.clienteId) { sql+=' AND a."clienteId"=?'; params.push(filters.clienteId); }
    if (filters.profissionalId) { sql+=' AND a."profissionalId"=?'; params.push(filters.profissionalId); }
    if (filters.data) { sql+=' AND a.data::date=?::date'; params.push(filters.data); }
    if (filters.dataInicio && filters.dataFim) { sql+=' AND a.data::date BETWEEN ?::date AND ?::date'; params.push(filters.dataInicio,filters.dataFim); }
    sql += ' ORDER BY a.data DESC,a."horaInicio" DESC';
    if (filters.limit) { sql+=' LIMIT ?'; params.push(parseInt(filters.limit)); }
    const atendimentos = await query(sql, params);
    if (filters.comServicos) {
      for (const a of atendimentos) {
        a.servicos = await query(`SELECT as2.*,s.nome as "servicoNome" FROM atendimentos_servicos as2 LEFT JOIN servicos s ON as2."servicoId"=s.id WHERE as2."atendimentoId"=?`, [a.id]);
      }
    }
    return atendimentos;
  }

  static async update(id, data, itensProdutos, itensServicos, salonId) {
    return withTransaction(async (client) => {
      await clientQueryRun(client,
        `UPDATE atendimentos SET "clienteId"=?,"profissionalId"=?,"auxiliarId"=?,data=?,"horaInicio"=?,"horaFim"=?,desconto=?,observacoes=?,"totalProdutos"=?,"totalServicos"=?,"totalGeral"=?,"updatedAt"=NOW() WHERE id=? AND "salonId"=?`,
        [data.clienteId||null,data.profissionalId||null,data.auxiliarId||null,data.data,data.horaInicio||null,data.horaFim||null,data.desconto||0,data.observacoes||null,data.totalProdutos||0,data.totalServicos||0,data.totalGeral||0,id,salonId]
      );
      await clientQueryRun(client,'DELETE FROM atendimentos_produtos WHERE "atendimentoId"=?',[id]);
      await clientQueryRun(client,'DELETE FROM atendimentos_servicos WHERE "atendimentoId"=?',[id]);
      if (itensProdutos?.length) {
        for (const item of itensProdutos) {
          await clientQueryRun(client,'INSERT INTO atendimentos_produtos (id,"atendimentoId","produtoId","quantidadeUsada",unidade,"precoUnitario",subtotal) VALUES (?,?,?,?,?,?,?)',[uuidv4(),id,item.produtoId,item.quantidadeUsada,item.unidade||'unidade',item.precoUnitario,item.subtotal]);
          if (item.quantidadeUsada>0) await clientQueryRun(client,'UPDATE produtos SET estoque=estoque-?,"updatedAt"=NOW() WHERE id=? AND "salonId"=?',[item.quantidadeUsada,item.produtoId,salonId]);
        }
      }
      if (itensServicos?.length) {
        for (const item of itensServicos) {
          await clientQueryRun(client,'INSERT INTO atendimentos_servicos (id,"atendimentoId","servicoId","horaInicio","horaFim",preco,duracao) VALUES (?,?,?,?,?,?,?)',[uuidv4(),id,item.servicoId,item.horaInicio,item.horaFim,item.preco,item.duracao]);
        }
      }
      return Atendimento._findByIdClient(client, id, salonId);
    });
  }

  static async delete(id, salonId) {
    return withTransaction(async (client) => {
      const produtos = await clientQuery(client, 'SELECT "produtoId","quantidadeUsada" FROM atendimentos_produtos WHERE "atendimentoId"=?', [id]);
      await clientQueryRun(client, 'DELETE FROM atendimentos_produtos WHERE "atendimentoId"=?', [id]);
      await clientQueryRun(client, 'DELETE FROM atendimentos_servicos WHERE "atendimentoId"=?', [id]);
      await clientQueryRun(client, 'DELETE FROM fechamentos_atendimentos WHERE "atendimentoId"=?', [id]);
      for (const item of produtos) {
        if (item.quantidadeUsada > 0) {
          try { await clientQueryRun(client, 'UPDATE produtos SET estoque=estoque+?,"updatedAt"=NOW() WHERE id=? AND "salonId"=?', [item.quantidadeUsada, item.produtoId, salonId]); } catch {}
        }
      }
      return clientQueryRun(client, 'DELETE FROM atendimentos WHERE id=? AND "salonId"=?', [id, salonId]);
    });
  }
}

module.exports = Atendimento;
```
