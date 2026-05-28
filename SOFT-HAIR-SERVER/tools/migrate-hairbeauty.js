#!/usr/bin/env node
/**
 * migrate-hairbeauty.js
 * Migra dados do HairBeauty → SoftHair (PostgreSQL Render)
 * IDs são SERIAL (integer) — usa RETURNING para construir mapas de FK.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node tools/migrate-hairbeauty.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { Pool } = require('pg');

const CSV_DIR = '/tmp/hairbeauty/HairBeauty_Export';
const BATCH_SIZE = 200;
const SALAO_ID = 1; // já existe no banco

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str || str.trim() === '') return null;
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, d, mo, y, h = '00', mi = '00', s = '00'] = m;
  if (parseInt(y) > 2100) return null;
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

function parseDecimal(str) {
  if (!str || str.trim() === '') return 0;
  return parseFloat(str.replace(',', '.')) || 0;
}

function parseBool(str) {
  return str && str.trim().toLowerCase() === 'true';
}

function csvFile(name) {
  return path.join(CSV_DIR, `${name}.csv`);
}

async function readCSV(filename) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(csvFile(filename))
      .pipe(parse({ columns: true, skip_empty_lines: true, bom: true, trim: true, relax_quotes: true, relax_column_count: true }))
      .on('data', r => records.push(r))
      .on('end', () => resolve(records))
      .on('error', reject);
  });
}

async function streamCSV(filename, onBatch) {
  return new Promise((resolve, reject) => {
    let batch = [];
    let total = 0;
    const parser = parse({ columns: true, skip_empty_lines: true, bom: true, trim: true, relax_quotes: true, relax_column_count: true });

    parser.on('data', (row) => {
      batch.push(row);
      if (batch.length >= BATCH_SIZE) {
        parser.pause();
        const current = batch; batch = [];
        total += current.length;
        onBatch(current).then(() => {
          process.stdout.write(`\r  ${total} processados...`);
          parser.resume();
        }).catch(reject);
      }
    });

    parser.on('end', async () => {
      if (batch.length > 0) {
        total += batch.length;
        try { await onBatch(batch); } catch (e) { return reject(e); }
      }
      process.stdout.write(`\r  ${total} processados.      \n`);
      resolve(total);
    });

    parser.on('error', reject);
    fs.createReadStream(csvFile(filename)).pipe(parser);
  });
}

// Insert batch com RETURNING id — retorna array de ids gerados
async function insertBatchReturning(client, table, columns, rows) {
  if (!rows.length) return [];
  const placeholders = rows.map((_, ri) =>
    `(${columns.map((_, ci) => `$${ri * columns.length + ci + 1}`).join(',')})`
  ).join(',');
  const values = rows.flatMap(r => columns.map(c => r[c] !== undefined ? r[c] : null));
  const res = await client.query(
    `INSERT INTO ${table} (${columns.map(c => `"${c}"`).join(',')}) VALUES ${placeholders} RETURNING id`,
    values
  );
  return res.rows.map(r => r.id);
}

// Insert batch sem RETURNING (para grandes volumes já com FK resolvida)
async function insertBatch(client, table, columns, rows) {
  if (!rows.length) return;
  const placeholders = rows.map((_, ri) =>
    `(${columns.map((_, ci) => `$${ri * columns.length + ci + 1}`).join(',')})`
  ).join(',');
  const values = rows.flatMap(r => columns.map(c => r[c] !== undefined ? r[c] : null));
  await client.query(
    `INSERT INTO ${table} (${columns.map(c => `"${c}"`).join(',')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    values
  );
}

// ─── Etapas ──────────────────────────────────────────────────────────────────

async function migrarProfissionais(client) {
  console.log('\n[1/6] Profissionais (RECURSO)...');
  const rows = await readCSV('RECURSO');
  const percRows = await readCSV('PERC_COMISSAO');

  const comissaoMap = {};
  for (const p of percRows) {
    const cod = p.COD_RECURSO;
    if (!comissaoMap[cod]) comissaoMap[cod] = [];
    const val = parseDecimal(p.PERC_COMISSAO || '0');
    if (val > 0) comissaoMap[cod].push(val);
  }

  const profs = rows.filter(r => parseBool(r.ATIVO) && r.COD_RECURSO !== '1');
  const idMap = {}; // COD_RECURSO → db id

  for (const r of profs) {
    const comissoes = comissaoMap[r.COD_RECURSO] || [];
    const media = comissoes.length ? comissoes.reduce((a, b) => a + b, 0) / comissoes.length : 0;
    const res = await client.query(`
      INSERT INTO profissionais (salao_id, nome, telefone, email, especialidade, comissao_percentual, ativo)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
    `, [SALAO_ID, r.NOME || r.RECURSO, r.CELULAR || r.TELEFONE || '', r.EMAIL || null, 'Cabeleireiro', media, parseBool(r.ATIVO)]);
    idMap[r.COD_RECURSO] = res.rows[0].id;
  }

  console.log(`  ${profs.length} profissionais inseridos.`);
  return idMap;
}

async function migrarClientes(client) {
  console.log('\n[2/6] Clientes (CLIENTES ~18K)...');
  const idMap = {}; // COD_CLIENTE → db id
  let count = 0;

  await streamCSV('CLIENTES', async (batch) => {
    const rows = batch.filter(r => parseBool(r.ATIVO));
    if (!rows.length) return;

    // Inserir um a um para capturar IDs (batch RETURNING com múltiplas linhas)
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50).map(r => ({
        salao_id: SALAO_ID,
        nome: (r.NOME || r.APELIDO || 'Cliente').slice(0, 200),
        email: r.EMAIL ? r.EMAIL.slice(0, 200) : null,
        telefone: (r.TEL_CELULAR
          ? `(${r.DDD_CELULAR || ''}) ${r.TEL_CELULAR}`
          : r.TEL_RESIDENCIAL
            ? `(${r.DDD_RESIDENCIAL || ''}) ${r.TEL_RESIDENCIAL}`
            : '').trim().slice(0, 50),
        cpf: r.CPF_CNPJ_CLIENTE ? r.CPF_CNPJ_CLIENTE.slice(0, 20) : null,
        data_nascimento: parseDate(r.DT_NASCIMENTO) ? parseDate(r.DT_NASCIMENTO).slice(0, 10) : null,
        endereco: [r.ENDERECO, r.NUMERO, r.BAIRRO, r.CIDADE, r.ESTADO].filter(Boolean).join(', ').slice(0, 500) || null,
        observacoes: r.NOTE_GERAL || null,
        ativo: true,
        _cod: r.COD_CLIENTE,
      }));

      const cols = ['salao_id','nome','email','telefone','cpf','data_nascimento','endereco','observacoes','ativo'];
      const ids = await insertBatchReturning(client, 'clientes', cols, chunk);
      chunk.forEach((r, idx) => { idMap[r._cod] = ids[idx]; });
      count += chunk.length;
    }
  });

  console.log(`  ${count} clientes inseridos.`);
  return idMap;
}

async function migrarServicos(client) {
  console.log('\n[3/6] Serviços (SERVICOS + TB_PRECOS)...');
  const servicos = await readCSV('SERVICOS');
  const precos = await readCSV('TB_PRECOS');

  // Preço de venda real está em TB_PRECOS.PRECO_TABELA (BR: "54,0000").
  // VLR_PRECO_LISTA NÃO existe em TB_PRECOS (é "0,00" em SERVICOS) — usar isso zera tudo.
  const precoMap = {};
  for (const p of precos) {
    const val = parseDecimal(p.PRECO_TABELA);
    if (val > 0 && (!precoMap[p.COD_SERVICO] || val > precoMap[p.COD_SERVICO])) precoMap[p.COD_SERVICO] = val;
  }

  // Comissão por serviço (%) está em PERC_COMISSAO.PERC_COMISSAO.
  const comissaoMap = {};
  try {
    const percComissao = await readCSV('PERC_COMISSAO');
    for (const c of percComissao) {
      const val = parseDecimal(c.PERC_COMISSAO);
      if (val > 0 && (!comissaoMap[c.COD_SERVICO] || val > comissaoMap[c.COD_SERVICO])) comissaoMap[c.COD_SERVICO] = val;
    }
  } catch (e) { console.warn('  PERC_COMISSAO indisponível:', e.message); }

  const ativos = servicos.filter(s => parseBool(s.ATIVO));
  const idMap = {}; // COD_SERVICO → db id

  for (let i = 0; i < ativos.length; i += 50) {
    const chunk = ativos.slice(i, i + 50).map(s => ({
      salao_id: SALAO_ID,
      nome: s.SERVICO.slice(0, 200),
      descricao: null,
      preco: precoMap[s.COD_SERVICO] || 0,
      duracao_minutos: 30,
      comissao_percentual: comissaoMap[s.COD_SERVICO] || 0,
      ativo: true,
      _cod: s.COD_SERVICO,
    }));
    const cols = ['salao_id','nome','descricao','preco','duracao_minutos','comissao_percentual','ativo'];
    const ids = await insertBatchReturning(client, 'servicos', cols, chunk);
    chunk.forEach((r, idx) => { idMap[r._cod] = ids[idx]; });
  }

  console.log(`  ${ativos.length} serviços inseridos.`);
  return idMap;
}

async function migrarAgendamentos(client, clienteMap, profMap, servicoMap) {
  console.log('\n[4/6] Agendamentos (CAB + LIN_AGENDAMENTO ~400K)...');

  console.log('  Carregando linhas...');
  const linMap = {};
  await streamCSV('LIN_AGENDAMENTO', async (batch) => {
    for (const r of batch) if (!linMap[r.COD_AGENDAMENTO]) linMap[r.COD_AGENDAMENTO] = r;
  });

  const statusMap = { 'C': 'cancelado', 'A': 'agendado', 'F': 'concluido', 'N': 'agendado' };
  let count = 0;

  await streamCSV('CAB_AGENDAMENTO', async (batch) => {
    const rows = batch.map(r => {
      const lin = linMap[r.COD_AGENDAMENTO] || {};
      const profCod = lin.COD_RECURSO || r.COD_RECURSO;
      return {
        salao_id: SALAO_ID,
        cliente_id: clienteMap[r.COD_CLIENTE] || null,
        servico_id: servicoMap[lin.COD_ATIVIDADE] || null,
        profissional_id: profMap[profCod] || null,
        data_hora: parseDate(r.DT_AGENDAMENTO) || new Date().toISOString(),
        duracao_minutos: 30,
        status: statusMap[r.STATUS] || 'agendado',
        observacoes: r.NOTE_GERAL || null,
        valor: 0,
      };
    });

    const cols = ['salao_id','cliente_id','servico_id','profissional_id','data_hora','duracao_minutos','status','observacoes','valor'];
    await insertBatch(client, 'agendamentos', cols, rows);
    count += rows.length;
  });

  console.log(`  ${count} agendamentos inseridos.`);
}

async function migrarVendas(client, clienteMap) {
  console.log('\n[5/6] Vendas (ATENDIMENTO_PGTO ~249K)...');

  const condRows = await readCSV('COND_PGTO');
  const condMap = {};
  for (const c of condRows) condMap[c.COD_COND_PGTO] = c.COND_PGTO;

  console.log('  Carregando clientes dos atendimentos...');
  const atendClienteMap = {};
  await streamCSV('CAB_ATENDIMENTO', async (batch) => {
    for (const r of batch) atendClienteMap[r.COD_ATENDIMENTO] = r.COD_CLIENTE;
  });

  let count = 0;
  const vendaIdMap = {}; // COD_ATENDIMENTO-NUM_CHKT-PARCELA → db venda id

  // Precisamos do RETURNING para comissoes usarem venda_id
  // Processamos em batches menores com RETURNING
  await streamCSV('ATENDIMENTO_PGTO', async (batch) => {
    const rows = batch.map(r => {
      const clienteCod = atendClienteMap[r.COD_ATENDIMENTO];
      return {
        salao_id: SALAO_ID,
        cliente_id: clienteMap[clienteCod] || null,
        profissional_id: null,
        tipo: 'servico',
        status: 'concluida',
        valor_total: parseDecimal(r.VLR_PAGO),
        desconto: 0,
        valor_final: parseDecimal(r.VLR_PAGO),
        forma_pagamento: (condMap[r.COD_COND_PGTO] || 'Outros').slice(0, 100),
        observacoes: null,
        _key: `${r.COD_ATENDIMENTO}-${r.NUM_CHKT}-${r.PARCELA_PGTO}`,
      };
    });

    const cols = ['salao_id','cliente_id','profissional_id','tipo','status','valor_total','desconto','valor_final','forma_pagamento','observacoes'];
    const ids = await insertBatchReturning(client, 'vendas', cols, rows);
    rows.forEach((r, idx) => { vendaIdMap[r._key] = ids[idx]; });
    count += rows.length;
  });

  console.log(`  ${count} vendas inseridas.`);
  return vendaIdMap;
}

async function migrarComissoes(client, profMap, vendaIdMap) {
  console.log('\n[6/6] Comissões (COMISSAO_LIN_ATENDIMENTO ~664K)...');
  let count = 0;

  await streamCSV('COMISSAO_LIN_ATENDIMENTO', async (batch) => {
    const rows = batch
      .filter(r => parseDecimal(r.VLR_COMISSAO) > 0 && r.COD_RECURSO && profMap[r.COD_RECURSO])
      .map(r => {
        const key = `${r.COD_ATENDIMENTO}-${r.NUM_CHKT || 1}-${r.PARCELA_PGTO}`;
        return {
          salao_id: SALAO_ID,
          profissional_id: profMap[r.COD_RECURSO],
          venda_id: vendaIdMap[key] || null,
          valor_total: parseDecimal(r.VLR_SERV_PAGO),
          percentual: 0,
          valor_comissao: parseDecimal(r.VLR_COMISSAO),
          pago: r.DT_PGTO_COMISSAO && r.DT_PGTO_COMISSAO.trim() !== '',
          data_pagamento: parseDate(r.DT_PGTO_COMISSAO) ? parseDate(r.DT_PGTO_COMISSAO).slice(0, 10) : null,
        };
      })
      .filter(r => r.venda_id); // só insere se tem venda vinculada

    if (!rows.length) return;
    const cols = ['salao_id','profissional_id','venda_id','valor_total','percentual','valor_comissao','pago','data_pagamento'];
    await insertBatch(client, 'comissoes', cols, rows);
    count += rows.length;
  });

  console.log(`  ${count} comissões inseridas.`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não definida.');
    process.exit(1);
  }

  console.log('🔌 Conectando...');
  const client = await pool.connect();

  try {
    console.log('✅ Conectado.\n' + '='.repeat(50));
    console.log('  MIGRAÇÃO HAIRBEAUTY → SOFTHAIR');
    console.log('='.repeat(50));

    const start = Date.now();

    const profMap    = await migrarProfissionais(client);
    const clienteMap = await migrarClientes(client);
    const servicoMap = await migrarServicos(client);
    await migrarAgendamentos(client, clienteMap, profMap, servicoMap);
    const vendaIdMap = await migrarVendas(client, clienteMap);
    await migrarComissoes(client, profMap, vendaIdMap);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Migração concluída em ${elapsed}s`);
    console.log('='.repeat(50));

  } catch (err) {
    console.error('\n❌ Erro:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
