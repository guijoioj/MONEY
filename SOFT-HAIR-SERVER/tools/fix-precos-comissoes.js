#!/usr/bin/env node
/**
 * fix-precos-comissoes.js
 *
 * Repara preços e comissões que vieram ZERADOS da migração HairBeauty.
 *
 * Causa raiz: migrate-hairbeauty.js lia `VLR_PRECO_LISTA` (que não existe em
 * TB_PRECOS e é "0,00" em SERVICOS) em vez de `PRECO_TABELA`. Resultado:
 * todos os serviços/produtos ficaram com preço 0. Comissão por serviço também
 * nunca foi puxada (hardcoded 0) — o valor real está em PERC_COMISSAO.
 *
 * Este script:
 *   1. Lê SERVICOS.csv     → COD_SERVICO → nome
 *   2. Lê TB_PRECOS.csv    → COD_SERVICO → PRECO_TABELA (maior preço válido)
 *   3. Lê PERC_COMISSAO.csv→ COD_SERVICO → PERC_COMISSAO (maior %)
 *   4. Casa por NOME (normalizado) com as linhas das tabelas `produtos` e
 *      `servicos` no banco e atualiza preço/comissão.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node tools/fix-precos-comissoes.js            # dry-run
 *   DATABASE_URL="postgresql://..." node tools/fix-precos-comissoes.js --apply    # grava
 *   CSV_DIR=/caminho node tools/fix-precos-comissoes.js --apply
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { Pool } = require('pg');

const CSV_DIR = process.env.CSV_DIR || '/home/ogejota/Downloads/HairBeauty_Export';
const SALAO_ID = parseInt(process.env.SALAO_ID || '1', 10);
const APPLY = process.argv.includes('--apply');

if (!process.env.DATABASE_URL) {
  console.error('ERRO: defina DATABASE_URL (pegue no painel do Render → banco → External Database URL).');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

function readCSV(name) {
  const file = path.join(CSV_DIR, `${name}.csv`);
  const content = fs.readFileSync(file);
  return parse(content, { columns: true, skip_empty_lines: true, bom: true, trim: true, relax_quotes: true, relax_column_count: true });
}

function parseDecimal(str) {
  if (str === undefined || str === null || String(str).trim() === '') return 0;
  let s = String(str).trim();
  // formato BR: ponto = separador de milhar, vírgula = decimal ("1.234,56" → 1234.56)
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
}

// Normaliza nome para casamento: sem acento, minúsculo, espaços colapsados
function norm(s) {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

async function run() {
  console.log(`\n${APPLY ? '⚙️  MODO APPLY (vai gravar)' : '🔍 DRY-RUN (nada será gravado)'} · CSV_DIR=${CSV_DIR}\n`);

  // 1) SERVICOS.csv → COD_SERVICO → nome
  const servicosCsv = readCSV('SERVICOS');
  const codToNome = {};
  for (const s of servicosCsv) {
    if (s.COD_SERVICO && s.SERVICO) codToNome[s.COD_SERVICO] = s.SERVICO.trim();
  }

  // 2) TB_PRECOS.csv → COD_SERVICO → maior PRECO_TABELA (preços sobem com o tempo)
  const precosCsv = readCSV('TB_PRECOS');
  const precoByCod = {};
  for (const p of precosCsv) {
    const v = parseDecimal(p.PRECO_TABELA);
    if (v > 0 && (!precoByCod[p.COD_SERVICO] || v > precoByCod[p.COD_SERVICO])) {
      precoByCod[p.COD_SERVICO] = v;
    }
  }

  // 3) PERC_COMISSAO.csv → COD_SERVICO → maior PERC_COMISSAO
  let comissaoByCod = {};
  try {
    const comCsv = readCSV('PERC_COMISSAO');
    for (const c of comCsv) {
      const v = parseDecimal(c.PERC_COMISSAO);
      if (v > 0 && (!comissaoByCod[c.COD_SERVICO] || v > comissaoByCod[c.COD_SERVICO])) {
        comissaoByCod[c.COD_SERVICO] = v;
      }
    }
  } catch (e) { console.warn('PERC_COMISSAO indisponível:', e.message); }

  // 4) Resolve por nome (normalizado)
  const precoByNome = {};
  const comissaoByNome = {};
  for (const cod of Object.keys(codToNome)) {
    const nomeN = norm(codToNome[cod]);
    if (!nomeN) continue;
    const preco = precoByCod[cod];
    const com = comissaoByCod[cod];
    if (preco > 0 && (!precoByNome[nomeN] || preco > precoByNome[nomeN])) precoByNome[nomeN] = preco;
    if (com > 0 && (!comissaoByNome[nomeN] || com > comissaoByNome[nomeN])) comissaoByNome[nomeN] = com;
  }

  console.log(`Mapas: ${Object.keys(precoByNome).length} nomes com preço, ${Object.keys(comissaoByNome).length} nomes com comissão.\n`);

  const client = await pool.connect();
  try {
    if (APPLY) await client.query('BEGIN');

    // ── PRODUTOS ──
    const produtos = (await client.query(
      'SELECT id, nome, preco_venda, preco_custo FROM produtos WHERE salao_id = $1', [SALAO_ID]
    )).rows;
    let prodUpd = 0, prodSemMatch = 0;
    const prodSample = [];
    for (const p of produtos) {
      const preco = precoByNome[norm(p.nome)];
      if (!preco || preco <= 0) { if (Number(p.preco_venda) <= 0.01) prodSemMatch++; continue; }
      if (Number(p.preco_venda) === preco) continue;
      if (prodSample.length < 12) prodSample.push(`  [${p.id}] ${p.nome}: R$${Number(p.preco_venda).toFixed(2)} → R$${preco.toFixed(2)}`);
      if (APPLY) {
        await client.query(
          'UPDATE produtos SET preco_venda = $1, preco_custo = CASE WHEN COALESCE(preco_custo,0) <= 0.01 THEN $1 ELSE preco_custo END, updated_at = NOW() WHERE id = $2',
          [preco, p.id]
        );
      }
      prodUpd++;
    }

    // ── SERVICOS ──
    const servicos = (await client.query(
      'SELECT id, nome, preco, comissao_percentual FROM servicos WHERE salao_id = $1', [SALAO_ID]
    )).rows;
    let servUpd = 0, servSemMatch = 0;
    const servSample = [];
    for (const s of servicos) {
      const preco = precoByNome[norm(s.nome)];
      const com = comissaoByNome[norm(s.nome)];
      const novoPreco = (preco > 0) ? preco : Number(s.preco);
      const novaCom = (com > 0) ? com : Number(s.comissao_percentual || 0);
      const mudouPreco = preco > 0 && Number(s.preco) !== preco;
      const mudouCom = com > 0 && Number(s.comissao_percentual || 0) !== com;
      if (!mudouPreco && !mudouCom) { if (Number(s.preco) <= 0.01) servSemMatch++; continue; }
      if (servSample.length < 12) servSample.push(`  [${s.id}] ${s.nome}: R$${Number(s.preco).toFixed(2)}→R$${novoPreco.toFixed(2)} | com ${Number(s.comissao_percentual||0)}%→${novaCom}%`);
      if (APPLY) {
        await client.query(
          'UPDATE servicos SET preco = $1, comissao_percentual = $2, updated_at = NOW() WHERE id = $3',
          [novoPreco, novaCom, s.id]
        );
      }
      servUpd++;
    }

    if (APPLY) await client.query('COMMIT');

    console.log('── PRODUTOS ──');
    console.log(prodSample.join('\n') || '  (nenhuma mudança)');
    console.log(`  Total: ${produtos.length} | ${APPLY ? 'atualizados' : 'a atualizar'}: ${prodUpd} | ainda sem preço (sem match): ${prodSemMatch}\n`);

    console.log('── SERVIÇOS ──');
    console.log(servSample.join('\n') || '  (nenhuma mudança)');
    console.log(`  Total: ${servicos.length} | ${APPLY ? 'atualizados' : 'a atualizar'}: ${servUpd} | ainda sem preço (sem match): ${servSemMatch}\n`);

    console.log(APPLY ? '✅ Gravado.' : '🔍 Dry-run. Rode com --apply para gravar.');
  } catch (err) {
    if (APPLY) await client.query('ROLLBACK');
    console.error('ERRO — rollback:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
