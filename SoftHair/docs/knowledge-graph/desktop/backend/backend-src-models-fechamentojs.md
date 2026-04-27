# backend/src/models/Fechamento.js

**Repository:** Desktop
**File:** `backend/src/models/Fechamento.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/models/Fechamento.js` do repositório Desktop.

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

const CREDITO_PERCENTUAL = 0.05;
const CREDITO_MINIMO = 100;

class Fechamento {
  static async create(data, atendimentoIds, vendaIds, salonId) {
    return withTransaction(async (client) => {
      const id = uuidv4();
      const ClienteHistorico = require('./ClienteHistorico');
      const CreditoCliente = require('./CreditoCliente');
      const totalGeral = data.totalGeral || 0;
      const creditoGanho = totalGeral >= CREDITO_MINIMO ? totalGeral * CREDITO_PERCENTUAL : 0;

      await clientQueryRun(client,
        `INSERT INTO fechamentos (id,"clienteId","profissionalId",data,"totalAtendimentos","totalVendas","totalProdutos","descontoGeral","totalGeral","formaPagamento",observacoes,"salonId")
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id,data.clienteId||null,data.profissionalId||null,data.data||new Date().toISOString().split('T')[0],
         data.totalAtendimentos||0,data.totalVendas||0,data.totalProdutos||0,data.descontoGeral||0,
         totalGeral,data.formaPagamento||null,data.observacoes||null,salonId]
      );

      const servicosFavMap = new Map();
      const produtosFavMap = new Map();

      // Snapshots captured before deletion — used to build the return value
      const atendimentosSnapshot = [];
      const vendasSnapshot = [];

      for (const atendimentoId of atendimentoIds) {
        await clientQueryRun(client,'INSERT INTO fechamentos_atendimentos (id,"fechamentoId","atendimentoId") VALUES (?,?,?)',[uuidv4(),id,atendimentoId]);

        // Capture full atendimento data BEFORE deleting rows
        const atend = await clientQueryOne(client,`SELECT a.*,p.nome as "profissionalNome" FROM atendimentos a LEFT JOIN profissionais p ON p.id=a."profissionalId" WHERE a.id=?`,[atendimentoId]);
        const servicos = await clientQuery(client,`SELECT as2.*,s.nome as "servicoNome",s.id as "servicoId",s.nome,s.categoria,as2.preco FROM atendimentos_servicos as2 JOIN servicos s ON s.id=as2."servicoId" WHERE as2."atendimentoId"=?`,[atendimentoId]);
        const produtosAtend = await clientQuery(client,'SELECT ap.*,pr.nome as "produtoNome" FROM atendimentos_produtos ap LEFT JOIN produtos pr ON ap."produtoId"=pr.id WHERE ap."atendimentoId"=?',[atendimentoId]);

        if (atend) {
          atend.servicos = servicos;
          atend.produtos = produtosAtend;
          atendimentosSnapshot.push(atend);
        }

        if (data.clienteId) {
          try {
            for (const s of servicos) {
              const ex=servicosFavMap.get(s.servicoId||s.id);
              if(ex){ex.quantidade+=1;ex.totalGasto+=(s.preco||0);}
              else{servicosFavMap.set(s.servicoId||s.id,{id:s.servicoId||s.id,nome:s.nome,categoria:s.categoria,quantidade:1,totalGasto:s.preco||0});}
            }
            if(atend){
              const nomes=servicos.map(s=>s.nome||s.servicoNome).join(', ')||'Serviços diversos';
              await ClienteHistorico.create({clienteId:data.clienteId,tipo:'atendimento',descricao:`Atendimento - ${nomes} (${atend.profissionalNome||'Profissional'}) - R$ ${(atend.totalGeral||0).toFixed(2)}`,entidadeId:atendimentoId,data:atend.data},salonId);
            }
          } catch(e){console.error('Erro histórico atendimento:',e.message);}
        }
        await clientQueryRun(client,'DELETE FROM atendimentos_servicos WHERE "atendimentoId"=?',[atendimentoId]);
        await clientQueryRun(client,'DELETE FROM atendimentos_produtos WHERE "atendimentoId"=?',[atendimentoId]);
        await clientQueryRun(client,'DELETE FROM fechamentos_atendimentos WHERE "atendimentoId"=? AND "fechamentoId"!=?',[atendimentoId,id]);
        await clientQueryRun(client,'DELETE FROM atendimentos WHERE id=? AND "salonId"=?',[atendimentoId,salonId]);
        await clientQueryRun(client,`UPDATE agendamentos SET status='cancelado' WHERE "atendimentoId"=?`,[atendimentoId]);
      }

      for (const vendaId of vendaIds) {
        await clientQueryRun(client,'INSERT INTO fechamentos_vendas (id,"fechamentoId","vendaId") VALUES (?,?,?)',[uuidv4(),id,vendaId]);

        // Capture full venda data BEFORE deleting rows
        const venda = await clientQueryOne(client,'SELECT v.*,p.nome as "vendedorNome" FROM vendas v LEFT JOIN profissionais p ON v."vendedorId"=p.id WHERE v.id=?',[vendaId]);
        const itens = await clientQuery(client,'SELECT vi.*,pr.nome as "produtoNome",s.nome as "servicoNome" FROM vendas_itens vi LEFT JOIN produtos pr ON vi."itemId"=pr.id LEFT JOIN servicos s ON vi."itemId"=s.id WHERE vi."vendaId"=?',[vendaId]);

        if (venda) {
          venda.itens = itens;
          vendasSnapshot.push(venda);
        }

        if(data.clienteId){
          try{
            const produtosVenda=itens.filter(i=>i.tipo==='produto');
            for(const p of produtosVenda){
              const ex=produtosFavMap.get(p.itemId);
              if(ex){ex.quantidade+=(p.quantidade||1);ex.totalGasto+=(p.subtotal||0);}
              else{produtosFavMap.set(p.itemId,{id:p.itemId,nome:p.produtoNome,categoria:null,quantidade:p.quantidade||1,totalGasto:p.subtotal||0});}
            }
            if(venda){
              const nomes=produtosVenda.map(p=>p.produtoNome).join(', ')||'Produtos diversos';
              await ClienteHistorico.create({clienteId:data.clienteId,tipo:'venda',descricao:`Compra - ${nomes} - R$ ${(venda.total||0).toFixed(2)}`,entidadeId:vendaId,data:venda.data},salonId);
            }
          }catch(e){console.error('Erro histórico venda:',e.message);}
        }
        await clientQueryRun(client,'DELETE FROM vendas_itens WHERE "vendaId"=?',[vendaId]);
        await clientQueryRun(client,'DELETE FROM fechamentos_vendas WHERE "vendaId"=? AND "fechamentoId"!=?',[vendaId,id]);
        await clientQueryRun(client,'DELETE FROM vendas WHERE id=? AND "salonId"=?',[vendaId,salonId]);
      }

      if(data.clienteId){
        try{
          const favExist=await clientQuery(client,'SELECT * FROM cliente_favoritos WHERE "clienteId"=? AND "salonId"=?',[data.clienteId,salonId]);
          const favMap=new Map(favExist.map(f=>[`${f.tipo}-${f.itemId}`,f]));
          for(const[itemId,s] of servicosFavMap){
            const ex=favMap.get(`servico-${itemId}`);
            if(ex){await clientQueryRun(client,'UPDATE cliente_favoritos SET quantidade=quantidade+?,"totalGasto"="totalGasto"+?,"updatedAt"=NOW() WHERE id=?',[s.quantidade,s.totalGasto,ex.id]);}
            else{await clientQueryRun(client,'INSERT INTO cliente_favoritos (id,"clienteId",tipo,"itemId",nome,categoria,quantidade,"totalGasto","salonId") VALUES (?,?,?,?,?,?,?,?,?)',[uuidv4(),data.clienteId,'servico',itemId,s.nome,s.categoria,s.quantidade,s.totalGasto,salonId]);}
          }
          for(const[itemId,p] of produtosFavMap){
            const ex=favMap.get(`produto-${itemId}`);
            if(ex){await clientQueryRun(client,'UPDATE cliente_favoritos SET quantidade=quantidade+?,"totalGasto"="totalGasto"+?,"updatedAt"=NOW() WHERE id=?',[p.quantidade,p.totalGasto,ex.id]);}
            else{await clientQueryRun(client,'INSERT INTO cliente_favoritos (id,"clienteId",tipo,"itemId",nome,categoria,quantidade,"totalGasto","salonId") VALUES (?,?,?,?,?,?,?,?,?)',[uuidv4(),data.clienteId,'produto',itemId,p.nome,p.categoria,p.quantidade,p.totalGasto,salonId]);}
          }
          await ClienteHistorico.create({clienteId:data.clienteId,tipo:'fechamento',descricao:`Fechamento - Total: R$ ${totalGeral.toFixed(2)} - ${data.formaPagamento||'Pagamento não informado'}`,entidadeId:id,data:data.data||new Date().toISOString().split('T')[0]},salonId);
          if(creditoGanho>0){await CreditoCliente.create({clienteId:data.clienteId,tipo:'fidelidade',valor:creditoGanho,descricao:`Fidelidade 5% - compra acima de R$ ${CREDITO_MINIMO}`},salonId);}
        }catch(e){console.error('Erro favoritos/histórico:',e.message);}
      }

      // Build return value from in-memory snapshots (atendimentos/vendas were deleted above)
      const f = await clientQueryOne(client,`SELECT f.*,c.nome as "clienteNome",c.telefone as "clienteTelefone",p.nome as "profissionalNome" FROM fechamentos f LEFT JOIN clientes c ON f."clienteId"=c.id LEFT JOIN profissionais p ON f."profissionalId"=p.id WHERE f.id=? AND f."salonId"=?`,[id,salonId]);
      if (f) {
        f.atendimentos = atendimentosSnapshot;
        f.vendas = vendasSnapshot;
      }
      return f;
    });
  }

  static async _findByIdClient(client, id, salonId) {
    const f=await clientQueryOne(client,`SELECT f.*,c.nome as "clienteNome",c.telefone as "clienteTelefone",p.nome as "profissionalNome" FROM fechamentos f LEFT JOIN clientes c ON f."clienteId"=c.id LEFT JOIN profissionais p ON f."profissionalId"=p.id WHERE f.id=? AND f."salonId"=?`,[id,salonId]);
    if(!f) return null;
    const aIds=(await clientQuery(client,'SELECT "atendimentoId" FROM fechamentos_atendimentos WHERE "fechamentoId"=?',[id])).map(r=>r.atendimentoId);
    const vIds=(await clientQuery(client,'SELECT "vendaId" FROM fechamentos_vendas WHERE "fechamentoId"=?',[id])).map(r=>r.vendaId);
    f.atendimentos=(await Promise.all(aIds.map(async aId=>{
      const a=await clientQueryOne(client,'SELECT a.*,p.nome as "profissionalNome" FROM atendimentos a LEFT JOIN profissionais p ON a."profissionalId"=p.id WHERE a.id=?',[aId]);
      if(!a) return null;
      a.produtos=await clientQuery(client,'SELECT ap.*,pr.nome as "produtoNome" FROM atendimentos_produtos ap LEFT JOIN produtos pr ON ap."produtoId"=pr.id WHERE ap."atendimentoId"=?',[aId]);
      a.servicos=await clientQuery(client,'SELECT as2.*,s.nome as "servicoNome" FROM atendimentos_servicos as2 LEFT JOIN servicos s ON as2."servicoId"=s.id WHERE as2."atendimentoId"=?',[aId]);
      return a;
    }))).filter(Boolean);
    f.vendas=(await Promise.all(vIds.map(async vId=>{
      const v=await clientQueryOne(client,'SELECT v.*,p.nome as "vendedorNome" FROM vendas v LEFT JOIN profissionais p ON v."vendedorId"=p.id WHERE v.id=?',[vId]);
      if(!v) return null;
      v.itens=await clientQuery(client,'SELECT vi.*,pr.nome as "produtoNome",s.nome as "servicoNome" FROM vendas_itens vi LEFT JOIN produtos pr ON vi."itemId"=pr.id LEFT JOIN servicos s ON vi."itemId"=s.id WHERE vi."vendaId"=?',[vId]);
      return v;
    }))).filter(Boolean);
    return f;
  }

  static async findById(id, salonId) {
    const f=await queryOne(`SELECT f.*,c.nome as "clienteNome",c.telefone as "clienteTelefone",p.nome as "profissionalNome" FROM fechamentos f LEFT JOIN clientes c ON f."clienteId"=c.id LEFT JOIN profissionais p ON f."profissionalId"=p.id WHERE f.id=? AND f."salonId"=?`,[id,salonId]);
    if(!f) return null;
    const aIds=(await query('SELECT "atendimentoId" FROM fechamentos_atendimentos WHERE "fechamentoId"=?',[id])).map(r=>r.atendimentoId);
    const vIds=(await query('SELECT "vendaId" FROM fechamentos_vendas WHERE "fechamentoId"=?',[id])).map(r=>r.vendaId);
    f.atendimentos=(await Promise.all(aIds.map(async aId=>{
      const a=await queryOne('SELECT a.*,p.nome as "profissionalNome" FROM atendimentos a LEFT JOIN profissionais p ON a."profissionalId"=p.id WHERE a.id=?',[aId]);
      if(!a) return null;
      a.produtos=await query('SELECT ap.*,pr.nome as "produtoNome" FROM atendimentos_produtos ap LEFT JOIN produtos pr ON ap."produtoId"=pr.id WHERE ap."atendimentoId"=?',[aId]);
      a.servicos=await query('SELECT as2.*,s.nome as "servicoNome" FROM atendimentos_servicos as2 LEFT JOIN servicos s ON as2."servicoId"=s.id WHERE as2."atendimentoId"=?',[aId]);
      return a;
    }))).filter(Boolean);
    f.vendas=(await Promise.all(vIds.map(async vId=>{
      const v=await queryOne('SELECT v.*,p.nome as "vendedorNome" FROM vendas v LEFT JOIN profissionais p ON v."vendedorId"=p.id WHERE v.id=?',[vId]);
      if(!v) return null;
      v.itens=await query('SELECT vi.*,pr.nome as "produtoNome",s.nome as "servicoNome" FROM vendas_itens vi LEFT JOIN produtos pr ON vi."itemId"=pr.id LEFT JOIN servicos s ON vi."itemId"=s.id WHERE vi."vendaId"=?',[vId]);
      return v;
    }))).filter(Boolean);
    return f;
  }

  static async getAll(filters={}, salonId) {
    try {
      let sql=`SELECT f.*,c.nome as "clienteNome",p.nome as "profissionalNome" FROM fechamentos f LEFT JOIN clientes c ON f."clienteId"=c.id LEFT JOIN profissionais p ON f."profissionalId"=p.id WHERE f."salonId"=?`;
      const params=[salonId];
      if(filters.clienteId){sql+=' AND f."clienteId"=?';params.push(filters.clienteId);}
      if(filters.profissionalId){sql+=' AND f."profissionalId"=?';params.push(filters.profissionalId);}
      if(filters.data){sql+=' AND f.data::date=?::date';params.push(filters.data);}
      if(filters.dataInicio&&filters.dataFim){sql+=' AND f.data::date BETWEEN ?::date AND ?::date';params.push(filters.dataInicio,filters.dataFim);}
      sql+=' ORDER BY f.data DESC,f."createdAt" DESC';
      if(filters.limit){sql+=' LIMIT ?';params.push(parseInt(filters.limit));}
      return query(sql, params);
    } catch(e){console.error('Erro Fechamento.getAll:',e);return[];}
  }

  static async getEmAberto(filters={}, salonId) {
    try {
      const clientesAbertos=new Map();
      let sqlAt=`SELECT a.*,c.nome as "clienteNome",c.telefone as "clienteTelefone",p.nome as "profissionalNome" FROM atendimentos a LEFT JOIN clientes c ON a."clienteId"=c.id LEFT JOIN profissionais p ON a."profissionalId"=p.id WHERE a.status='aberto' AND a."salonId"=?`;
      const paramsAt=[salonId];
      if(filters.clienteId){sqlAt+=' AND a."clienteId"=?';paramsAt.push(filters.clienteId);}
      if(filters.profissionalId){sqlAt+=' AND a."profissionalId"=?';paramsAt.push(filters.profissionalId);}
      if(filters.clienteNome){sqlAt+=' AND c.nome ILIKE ?';paramsAt.push(`%${filters.clienteNome}%`);}
      const atAbertos=await query(sqlAt,paramsAt);
      for(const a of atAbertos){
        const cId=a.clienteId||'sem-cliente';
        if(!clientesAbertos.has(cId)) clientesAbertos.set(cId,{clienteId:a.clienteId,clienteNome:a.clienteNome||'Consumidor Final',clienteTelefone:a.clienteTelefone,atendimentos:[],vendas:[],totalAtendimentos:0,totalVendas:0,totalGeral:0});
        const produtos=await query('SELECT ap.*,pr.nome as "produtoNome" FROM atendimentos_produtos ap LEFT JOIN produtos pr ON ap."produtoId"=pr.id WHERE ap."atendimentoId"=?',[a.id]);
        const servicos=await query('SELECT as2.*,s.nome as "servicoNome" FROM atendimentos_servicos as2 LEFT JOIN servicos s ON as2."servicoId"=s.id WHERE as2."atendimentoId"=?',[a.id]);
        clientesAbertos.get(cId).atendimentos.push({...a,produtos,servicos});
        clientesAbertos.get(cId).totalAtendimentos+=(a.totalGeral||0);
        clientesAbertos.get(cId).totalGeral+=(a.totalGeral||0);
      }
      let sqlVd=`SELECT v.*,c.nome as "clienteNome",c.telefone as "clienteTelefone",p.nome as "vendedorNome" FROM vendas v LEFT JOIN clientes c ON v."clienteId"=c.id LEFT JOIN profissionais p ON v."vendedorId"=p.id WHERE v.status='aberto' AND v."salonId"=?`;
      const paramsVd=[salonId];
      if(filters.clienteId){sqlVd+=' AND v."clienteId"=?';paramsVd.push(filters.clienteId);}
      if(filters.profissionalId){sqlVd+=' AND v."vendedorId"=?';paramsVd.push(filters.profissionalId);}
      if(filters.clienteNome){sqlVd+=' AND c.nome ILIKE ?';paramsVd.push(`%${filters.clienteNome}%`);}
      const vendasAbertas=await query(sqlVd,paramsVd);
      for(const v of vendasAbertas){
        const cId=v.clienteId||'sem-cliente';
        if(!clientesAbertos.has(cId)) clientesAbertos.set(cId,{clienteId:v.clienteId,clienteNome:v.clienteNome||'Consumidor Final',clienteTelefone:v.clienteTelefone,atendimentos:[],vendas:[],totalAtendimentos:0,totalVendas:0,totalGeral:0});
        const itens=await query('SELECT vi.*,pr.nome as "produtoNome",s.nome as "servicoNome" FROM vendas_itens vi LEFT JOIN produtos pr ON vi."itemId"=pr.id LEFT JOIN servicos s ON vi."itemId"=s.id WHERE vi."vendaId"=?',[v.id]);
        clientesAbertos.get(cId).vendas.push({...v,itens});
        clientesAbertos.get(cId).totalVendas+=(v.total||0);
        clientesAbertos.get(cId).totalGeral+=(v.total||0);
      }
      return Array.from(clientesAbertos.values()).filter(c=>c.atendimentos.length>0||c.vendas.length>0);
    } catch(e){console.error('Erro Fechamento.getEmAberto:',e);return[];}
  }

  static async delete(id, salonId) {
    const f=await this.findById(id,salonId);
    if(!f) return false;
    if(f.atendimentos) for(const a of f.atendimentos) await queryRun(`UPDATE atendimentos SET status='aberto' WHERE id=?`,[a.id]);
    if(f.vendas) for(const v of f.vendas) await queryRun(`UPDATE vendas SET status='aberto' WHERE id=?`,[v.id]);
    await queryRun('DELETE FROM fechamentos_atendimentos WHERE "fechamentoId"=?',[id]);
    await queryRun('DELETE FROM fechamentos_vendas WHERE "fechamentoId"=?',[id]);
    await queryRun('DELETE FROM fechamentos WHERE id=? AND "salonId"=?',[id,salonId]);
    return true;
  }

  static async estornar(id, motivo, salonId) {
    const f=await this.findById(id,salonId);
    if(!f) return false;
    const ClienteHistorico=require('./ClienteHistorico');
    try{ await ClienteHistorico.create({clienteId:f.clienteId,tipo:'estorno',descricao:`Estorno de fechamento - Motivo: ${motivo} - Valor: R$ ${(f.totalGeral||0).toFixed(2)}`,entidadeId:id,data:new Date().toISOString().split('T')[0]},salonId); }catch(e){console.error(e.message);}
    if(f.atendimentos) for(const a of f.atendimentos) await queryRun(`UPDATE atendimentos SET status='aberto' WHERE id=?`,[a.id]);
    if(f.vendas) for(const v of f.vendas) await queryRun(`UPDATE vendas SET status='aberto' WHERE id=?`,[v.id]);
    await queryRun('INSERT INTO estornos (id,"fechamentoId",motivo,valor,"salonId") VALUES (?,?,?,?,?)',[uuidv4(),id,motivo,f.totalGeral,salonId]);
    await queryRun('DELETE FROM fechamentos_atendimentos WHERE "fechamentoId"=?',[id]);
    await queryRun('DELETE FROM fechamentos_vendas WHERE "fechamentoId"=?',[id]);
    await queryRun('DELETE FROM fechamentos WHERE id=? AND "salonId"=?',[id,salonId]);
    return true;
  }
}

module.exports = Fechamento;
```
