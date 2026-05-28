#!/usr/bin/env node
/**
 * seed-regras-comissao-servico.js
 *
 * Cria uma regra de comissão V2 (tipo='servico') por serviço que tem
 * comissao_percentual > 0. Reproduz fielmente o sistema antigo, onde a
 * comissão é definida POR SERVIÇO (35% / 50% / 70% etc).
 *
 * O motor V2 (CommissionEngine) lê APENAS regras_comissao — não usa
 * servicos.comissao_percentual. Sem regras, nenhuma comissão é calculada.
 *
 * Idempotente: pula serviços que já tenham regra tipo='servico'.
 * Não destrutivo: regras podem ser editadas/desativadas na UI.
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." node tools/seed-regras-comissao-servico.js          # dry-run
 *   DATABASE_URL="postgresql://..." node tools/seed-regras-comissao-servico.js --apply  # grava
 */

const { Pool } = require('pg');

const SALAO_ID = parseInt(process.env.SALAO_ID || '1', 10);
const APPLY = process.argv.includes('--apply');

if (!process.env.DATABASE_URL) {
  console.error('ERRO: defina DATABASE_URL.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function run() {
  console.log(`\n${APPLY ? '⚙️  MODO APPLY (vai gravar)' : '🔍 DRY-RUN (nada será gravado)'}\n`);
  const client = await pool.connect();
  try {
    // Serviços com comissão definida
    const servicos = (await client.query(
      `SELECT id, nome, comissao_percentual
         FROM servicos
        WHERE salao_id = $1 AND COALESCE(comissao_percentual, 0) > 0`,
      [SALAO_ID]
    )).rows;

    // Serviços que já têm regra tipo='servico' (idempotência)
    const jaTem = new Set((await client.query(
      `SELECT DISTINCT servico_id FROM regras_comissao
        WHERE salao_id = $1 AND tipo = 'servico' AND servico_id IS NOT NULL`,
      [SALAO_ID]
    )).rows.map(r => r.servico_id));

    const aCriar = servicos.filter(s => !jaTem.has(s.id));

    console.log(`Serviços com comissão > 0: ${servicos.length}`);
    console.log(`Já com regra: ${servicos.length - aCriar.length} | a criar: ${aCriar.length}\n`);
    aCriar.slice(0, 12).forEach(s => console.log(`  + [serv ${s.id}] ${s.nome} → ${Number(s.comissao_percentual)}% (valor_bruto)`));
    if (aCriar.length > 12) console.log(`  ... e mais ${aCriar.length - 12}`);

    if (APPLY && aCriar.length) {
      await client.query('BEGIN');
      for (const s of aCriar) {
        await client.query(
          `INSERT INTO regras_comissao
             (salao_id, nome, descricao, tipo, servico_id, base_calculo, percentual, ativo, prioridade, condicoes_json, criado_por)
           VALUES ($1, $2, $3, 'servico', $4, 'valor_bruto', $5, true, 0, '{}', 'migracao-hairbeauty')`,
          [SALAO_ID, `Comissão — ${s.nome}`.slice(0, 200), 'Importado do HairBeauty (PERC_COMISSAO)', s.id, Number(s.comissao_percentual)]
        );
      }
      await client.query('COMMIT');
      console.log(`\n✅ ${aCriar.length} regras criadas.`);
    } else {
      console.log(APPLY ? '\nNada a criar.' : '\n🔍 Dry-run. Rode com --apply para gravar.');
    }
  } catch (err) {
    if (APPLY) { try { await client.query('ROLLBACK'); } catch {} }
    console.error('ERRO — rollback:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
