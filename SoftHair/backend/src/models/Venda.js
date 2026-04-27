const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryRun, withTransaction, clientQuery, clientQueryOne, clientQueryRun } = require('../config/database');

class Venda {
  static async create(data, itens, salonId) {
    return withTransaction(async (client) => {
      const id = uuidv4();
      await clientQueryRun(client,
        'INSERT INTO vendas (id,"clienteId","vendedorId",data,total,"formaPagamento",observacoes,"atendimentoId","salonId") VALUES (?,?,?,?,?,?,?,?,?)',
        [id,data.clienteId||null,data.vendedorId||null,data.data||new Date().toISOString().split('T')[0],data.total,data.formaPagamento||null,data.observacoes||null,data.atendimentoId||null,salonId]
      );
      for (const item of itens) {
        await clientQueryRun(client,'INSERT INTO vendas_itens (id,"vendaId",tipo,"itemId",quantidade,"precoUnitario",subtotal) VALUES (?,?,?,?,?,?,?)',[uuidv4(),id,item.tipo,item.itemId,item.quantidade,item.precoUnitario,item.subtotal]);
        if (item.tipo==='produto') await clientQueryRun(client,'UPDATE produtos SET estoque=estoque-?,"updatedAt"=NOW() WHERE id=? AND "salonId"=?',[item.quantidade,item.itemId,salonId]);
      }
      return Venda._findByIdClient(client, id, salonId);
    });
  }

  static async _findByIdClient(client, id, salonId) {
    const v = await clientQueryOne(client,`SELECT v.*,c.nome as "clienteNome",p.nome as "vendedorNome" FROM vendas v LEFT JOIN clientes c ON v."clienteId"=c.id LEFT JOIN profissionais p ON v."vendedorId"=p.id WHERE v.id=? AND v."salonId"=?`,[id,salonId]);
    if (!v) return null;
    v.itens = await clientQuery(client,`SELECT vi.*,pr.nome as "produtoNome",s.nome as "servicoNome" FROM vendas_itens vi LEFT JOIN produtos pr ON vi."itemId"=pr.id LEFT JOIN servicos s ON vi."itemId"=s.id WHERE vi."vendaId"=?`,[id]);
    return v;
  }

  static async findById(id, salonId) {
    const v = await queryOne(`SELECT v.*,c.nome as "clienteNome",p.nome as "vendedorNome" FROM vendas v LEFT JOIN clientes c ON v."clienteId"=c.id LEFT JOIN profissionais p ON v."vendedorId"=p.id WHERE v.id=? AND v."salonId"=?`,[id,salonId]);
    if (!v) return null;
    v.itens = await query(`SELECT vi.*,pr.nome as "produtoNome",s.nome as "servicoNome" FROM vendas_itens vi LEFT JOIN produtos pr ON vi."itemId"=pr.id LEFT JOIN servicos s ON vi."itemId"=s.id WHERE vi."vendaId"=?`,[id]);
    return v;
  }

  static async update(id, data, itens, salonId) {
    return withTransaction(async (client) => {
      const existing = await Venda._findByIdClient(client, id, salonId);
      if (!existing) return null;
      for (const item of existing.itens) {
        if (item.tipo==='produto') await clientQueryRun(client,'UPDATE produtos SET estoque=estoque+?,"updatedAt"=NOW() WHERE id=? AND "salonId"=?',[item.quantidade,item.itemId,salonId]);
      }
      await clientQueryRun(client,'DELETE FROM vendas_itens WHERE "vendaId"=?',[id]);
      const total = itens.reduce((s,i)=>s+i.subtotal,0);
      await clientQueryRun(client,'UPDATE vendas SET "clienteId"=?,"vendedorId"=?,data=?,total=?,"formaPagamento"=?,observacoes=?,"updatedAt"=NOW() WHERE id=? AND "salonId"=?',[data.clienteId||null,data.vendedorId||null,data.data,total,data.formaPagamento||null,data.observacoes||null,id,salonId]);
      for (const item of itens) {
        await clientQueryRun(client,'INSERT INTO vendas_itens (id,"vendaId",tipo,"itemId",quantidade,"precoUnitario",subtotal) VALUES (?,?,?,?,?,?,?)',[uuidv4(),id,item.tipo,item.itemId,item.quantidade,item.precoUnitario,item.subtotal]);
        if (item.tipo==='produto') await clientQueryRun(client,'UPDATE produtos SET estoque=estoque-?,"updatedAt"=NOW() WHERE id=? AND "salonId"=?',[item.quantidade,item.itemId,salonId]);
      }
      return Venda._findByIdClient(client, id, salonId);
    });
  }

  static async delete(id, salonId) {
    return withTransaction(async (client) => {
      const existing = await Venda._findByIdClient(client, id, salonId);
      if (!existing) return false;
      await clientQueryRun(client,'DELETE FROM fechamentos_vendas WHERE "vendaId"=?',[id]);
      for (const item of existing.itens) {
        if (item.tipo==='produto') { try { await clientQueryRun(client,'UPDATE produtos SET estoque=estoque+?,"updatedAt"=NOW() WHERE id=? AND "salonId"=?',[item.quantidade,item.itemId,salonId]); } catch {} }
      }
      await clientQueryRun(client,'DELETE FROM vendas_itens WHERE "vendaId"=?',[id]);
      await clientQueryRun(client,'DELETE FROM vendas WHERE id=? AND "salonId"=?',[id,salonId]);
      return true;
    });
  }

  static async getAll(filters = {}, salonId) {
    let sql = `SELECT v.*,c.nome as "clienteNome",p.nome as "vendedorNome" FROM vendas v LEFT JOIN clientes c ON v."clienteId"=c.id LEFT JOIN profissionais p ON v."vendedorId"=p.id WHERE v."salonId"=?`;
    const params = [salonId];
    if (filters.clienteId) { sql+=' AND v."clienteId"=?'; params.push(filters.clienteId); }
    if (filters.data) { sql+=' AND v.data::date=?::date'; params.push(filters.data); }
    if (filters.dataInicio && filters.dataFim) { sql+=' AND v.data::date BETWEEN ?::date AND ?::date'; params.push(filters.dataInicio,filters.dataFim); }
    sql+=' ORDER BY v.data DESC,v."createdAt" DESC';
    if (filters.limit) { sql+=' LIMIT ?'; params.push(parseInt(filters.limit)); }
    const vendas = await query(sql, params);
    for (const v of vendas) {
      v.itens = await query(`SELECT vi.*,pr.nome as "produtoNome",s.nome as "servicoNome" FROM vendas_itens vi LEFT JOIN produtos pr ON vi."itemId"=pr.id LEFT JOIN servicos s ON vi."itemId"=s.id WHERE vi."vendaId"=?`,[v.id]);
    }
    return vendas;
  }

  static async getEstatisticas(filters = {}, salonId) {
    let sql = `SELECT COUNT(*) as "totalVendas",SUM(total) as "totalReceita",AVG(total) as "mediaVendas","formaPagamento",data::date as data FROM vendas WHERE "salonId"=?`;
    const params = [salonId];
    if (filters.dataInicio && filters.dataFim) { sql+=' AND data::date BETWEEN ?::date AND ?::date'; params.push(filters.dataInicio,filters.dataFim); }
    sql+=' GROUP BY data::date,"formaPagamento" ORDER BY data DESC';
    return query(sql, params);
  }
}

module.exports = Venda;
