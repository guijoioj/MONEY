#!/usr/bin/env node
/**
 * Corrige o timezone dos agendamentos LEGADOS importados do HairBeauty.
 *
 * PROBLEMA: a migração (migrate-hairbeauty.js -> parseDate) gravou data_hora como
 * hora LOCAL crua ("2026-04-01 16:00:00") sem timezone. O Postgres do Render (UTC)
 * devolve esse valor como se fosse UTC, e o frontend converte UTC->BRT subtraindo 3h.
 * Resultado: um agendamento das 16:00 aparece às 13:00 na agenda.
 *
 * Os agendamentos NOVOS (criados pelo app) já foram gravados corretamente em UTC
 * (o frontend faz new Date(local).toISOString()), então NÃO devem ser tocados.
 *
 * SOLUÇÃO: somar +3h em data_hora APENAS nos legados, deixando todos na mesma
 * convenção (UTC). A identificação do "legado" é por created_at < --legacy-before.
 *
 * USO (sempre dry-run primeiro):
 *   DATABASE_URL="postgresql://..." node tools/fix-tz-agendamentos-legados.js
 *      -> mostra distribuição de created_at (revela o lote da migração) e sai.
 *
 *   DATABASE_URL="postgresql://..." node tools/fix-tz-agendamentos-legados.js --legacy-before=2026-05-20
 *      -> dry-run: conta e mostra amostra antes/depois dos que seriam corrigidos.
 *
 *   DATABASE_URL="postgresql://..." node tools/fix-tz-agendamentos-legados.js --legacy-before=2026-05-20 --apply
 *      -> aplica de fato (transação). Também ajusta atendimentos convertidos desses.
 *
 * Opções:
 *   --hours=3        offset em horas (default 3, BRT)
 *   --legacy-before  data de corte (created_at < essa data = legado)
 *   --apply          grava (sem isso é só simulação)
 */

const { Pool } = require('pg');

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : def;
};
const APPLY = args.includes('--apply');
const HOURS = parseInt(getArg('hours', '3'), 10);
const LEGACY_BEFORE = getArg('legacy-before', null);

if (!process.env.DATABASE_URL) {
  console.error('ERRO: defina DATABASE_URL no ambiente. Ex.:');
  console.error('  DATABASE_URL="postgresql://..." node tools/fix-tz-agendamentos-legados.js');
  process.exit(1);
}

const ssl = /render\.com|amazonaws|supabase|neon\./.test(process.env.DATABASE_URL)
  ? { rejectUnauthorized: false }
  : false;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl });

async function main() {
  // Sempre mostra a distribuição de created_at — ajuda a achar o lote da migração.
  const dist = await pool.query(`
    SELECT DATE(created_at) AS dia, COUNT(*)::int AS qtd
      FROM agendamentos
     GROUP BY DATE(created_at)
     ORDER BY qtd DESC
     LIMIT 15
  `);
  console.log('\n== Distribuição de agendamentos por DATA de created_at (top 15) ==');
  console.log('(o dia com MUITOS registros é provavelmente o lote da migração)\n');
  for (const r of dist.rows) {
    console.log(`  ${r.dia ? r.dia.toISOString().slice(0, 10) : 'null'}  →  ${r.qtd}`);
  }

  if (!LEGACY_BEFORE) {
    console.log('\nPasse --legacy-before=YYYY-MM-DD para simular a correção dos legados.');
    console.log('Ex.: se o lote grande é 2026-05-19, use --legacy-before=2026-05-20\n');
    await pool.end();
    return;
  }

  const where = `created_at < $1::date AND data_hora IS NOT NULL`;
  const cnt = await pool.query(`SELECT COUNT(*)::int AS n FROM agendamentos WHERE ${where}`, [LEGACY_BEFORE]);
  const total = cnt.rows[0].n;

  const sample = await pool.query(`
    SELECT id, created_at,
           data_hora AS antes,
           (data_hora + ($2 || ' hours')::interval) AS depois
      FROM agendamentos
     WHERE ${where}
     ORDER BY id DESC
     LIMIT 10
  `, [LEGACY_BEFORE, String(HOURS)]);

  console.log(`\n== Legados (created_at < ${LEGACY_BEFORE}): ${total} agendamentos ==`);
  console.log(`Offset a aplicar: +${HOURS}h em data_hora\n`);
  console.log('Amostra (10 mais recentes):');
  for (const r of sample.rows) {
    const f = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 16) : 'null');
    console.log(`  #${r.id}  ${f(r.antes)}  →  ${f(r.depois)}`);
  }

  if (!APPLY) {
    console.log(`\n[DRY-RUN] Nada gravado. Para aplicar: adicione --apply\n`);
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE agendamentos
          SET data_hora = data_hora + ($2 || ' hours')::interval,
              updated_at = CURRENT_TIMESTAMP
        WHERE ${where}`,
      [LEGACY_BEFORE, String(HOURS)]
    );
    // Atendimentos convertidos desses agendamentos: corrige hora_inicio também.
    const updAt = await client.query(
      `UPDATE atendimentos at
          SET hora_inicio = (at.hora_inicio + ($1 || ' hours')::interval)::time,
              updated_at = CURRENT_TIMESTAMP
         FROM agendamentos ag
        WHERE at.agendamento_id = ag.id
          AND ag.created_at < $2::date
          AND at.hora_inicio IS NOT NULL`,
      [String(HOURS), LEGACY_BEFORE]
    );
    await client.query('COMMIT');
    console.log(`\n[APLICADO] agendamentos corrigidos: ${upd.rowCount}`);
    console.log(`[APLICADO] atendimentos (hora_inicio) corrigidos: ${updAt.rowCount}\n`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERRO — rollback:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
