#!/usr/bin/env node
/**
 * [P7-M2] Audit log retention — script manual operacional.
 *
 * O `audit_log` é tamper-evident (triggers BEFORE UPDATE/DELETE lançam exceção).
 * Esse script desabilita temporariamente o trigger de DELETE, purga entradas
 * mais antigas que N dias (default 1825 = 5 anos), e re-habilita.
 *
 * NÃO É EXECUTADO AUTOMATICAMENTE. Operação consciente apenas — rode via:
 *
 *   node src/scripts/auditCleanup.js --days=1825 --confirm=I_UNDERSTAND_AUDIT_RETENTION
 *
 * Política de retenção recomendada (SoftHair):
 *   - 5 anos (1825 dias) → compliance fiscal BR + LGPD opcional
 *   - Logs > 5 anos podem ser arquivados externamente antes do delete
 *
 * Roadmap futuro: particionar audit_log por mês com DROP PARTITION rolling.
 */
require('dotenv').config();
const { pool } = require('../config/database');

function parseArgs() {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.replace(/^--/, '').split('=');
    args[k] = v === undefined ? true : v;
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const days = parseInt(args.days, 10) || 1825; // default 5 anos
  const confirm = args.confirm;

  if (confirm !== 'I_UNDERSTAND_AUDIT_RETENTION') {
    console.error('❌ Operação destrutiva. Para confirmar passe:');
    console.error('   --confirm=I_UNDERSTAND_AUDIT_RETENTION');
    console.error('');
    console.error(`Vai apagar audit_log entries com created_at < NOW() - INTERVAL '${days} days'.`);
    process.exit(1);
  }

  if (days < 365) {
    console.error(`❌ Retenção mínima é 365 dias (passou ${days}). Logs forenses precisam de 1+ ano.`);
    process.exit(1);
  }

  console.log(`🧹 Auditoria: purgar entries > ${days} dias...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Contar antes
    const before = await client.query(
      `SELECT COUNT(*) AS n FROM audit_log WHERE created_at < NOW() - ($1 || ' days')::interval`,
      [String(days)]
    );
    const toDelete = parseInt(before.rows[0].n, 10);
    console.log(`📊 Entries a apagar: ${toDelete}`);

    if (toDelete === 0) {
      await client.query('COMMIT');
      console.log('✅ Nada para limpar.');
      return;
    }

    // Desabilitar trigger de proteção localmente (DISABLE TRIGGER é session-scoped quando
    // usado dentro de transação? Não — é DDL, requer permissão. Aqui usamos session_replication_role
    // que é mais seguro: bypass triggers user-defined apenas para esta sessão.)
    await client.query("SET LOCAL session_replication_role = 'replica'");

    const r = await client.query(
      `DELETE FROM audit_log WHERE created_at < NOW() - ($1 || ' days')::interval`,
      [String(days)]
    );

    // Inserir entry de auditoria do próprio cleanup (depois de reabilitar trigger)
    await client.query("SET LOCAL session_replication_role = 'origin'");
    await client.query(
      `INSERT INTO audit_log (action, entity_type, entity_id, actor_type, actor_id, after_data, created_at)
       VALUES ('audit.retention_cleanup', 'audit_log', NULL, 'system', NULL, $1::jsonb, NOW())`,
      [JSON.stringify({ days, deleted: r.rowCount, script: 'auditCleanup.js' })]
    );

    await client.query('COMMIT');
    console.log(`✅ Removidas ${r.rowCount} entries antigas. Cleanup auditado.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
  });
}

module.exports = { main };
