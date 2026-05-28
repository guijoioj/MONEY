/**
 * BackupHistoryService — gera dump JSON gzipado das tabelas-chave do salão
 * e persiste em `backups` (bytea). Também faz cleanup do retention.
 *
 * Não usa pg_dump (Render free não dá shell). Usa SELECTs por tabela.
 *
 * Tabelas incluídas (não-sensíveis: senha_hash é REDACTED no service auth):
 *   saloes, usuarios (sem senha_hash), clientes, profissionais (sem senha_hash),
 *   servicos, produtos, agendamentos, atendimentos, atendimentos_servicos,
 *   vendas, venda_itens, comissoes, fechamentos, creditos_cliente.
 *
 * Retention: mantém últimos N (default 14) por salão. DELETE em cascata.
 */

const { pool } = require('../config/database');
const zlib = require('zlib');
const crypto = require('crypto');

const TABLES = [
  'saloes', 'usuarios', 'clientes', 'profissionais',
  'servicos', 'produtos', 'agendamentos', 'atendimentos',
  'atendimentos_servicos', 'vendas', 'venda_itens',
  'comissoes', 'fechamentos', 'creditos_cliente',
];

const REDACT_COLS = new Set(['senha_hash', 'senha', 'push_token', 'token']);

function redactRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = REDACT_COLS.has(k.toLowerCase()) ? null : v;
  }
  return out;
}

async function _dumpTablesParaSalao(salaoId) {
  const dump = { _meta: { salao_id: salaoId, generated_at: new Date().toISOString(), version: 1 } };
  for (const table of TABLES) {
    try {
      const r = await pool.query(
        `SELECT * FROM ${table} WHERE salao_id = $1`,
        [salaoId]
      );
      dump[table] = r.rows.map(redactRow);
    } catch (e) {
      // Tabela pode não existir (ambiente legado) — pula com aviso.
      dump[table] = [];
      dump._meta.warnings = dump._meta.warnings || [];
      dump._meta.warnings.push(`${table}: ${e.message}`);
    }
  }
  return dump;
}

/**
 * runBackup({ salaoId, tipo='manual', criadoPor })
 * Cria registro pending, gera dump, comprime, salva. Retorna { id, tamanho_bytes }.
 * Em caso de erro, marca status='error' com mensagem.
 */
async function runBackup({ salaoId, tipo = 'manual', criadoPor = null }) {
  // Cria registro pending pra ter id e auditoria mesmo se falhar.
  const ins = await pool.query(
    `INSERT INTO backups (salao_id, tipo, status, criado_por)
     VALUES ($1, $2, 'pending', $3) RETURNING id`,
    [salaoId, tipo, criadoPor]
  );
  const id = ins.rows[0].id;

  try {
    const dump = await _dumpTablesParaSalao(salaoId);
    const json = JSON.stringify(dump);
    const gz = zlib.gzipSync(json);
    const checksum = crypto.createHash('sha256').update(gz).digest('hex');

    await pool.query(
      `UPDATE backups
          SET status = 'ok', tamanho_bytes = $1, checksum = $2, dump_data = $3
        WHERE id = $4`,
      [gz.length, checksum, gz, id]
    );
    return { success: true, id, tamanho_bytes: gz.length, checksum };
  } catch (e) {
    await pool.query(
      `UPDATE backups SET status = 'error', erro = $1 WHERE id = $2`,
      [String(e.message).slice(0, 1000), id]
    );
    return { success: false, id, error: e.message };
  }
}

/**
 * Retention: mantém os últimos N backups por salão. Apaga o resto.
 */
async function applyRetention({ salaoId, keep = 14 }) {
  const r = await pool.query(
    `DELETE FROM backups
       WHERE salao_id = $1
         AND id NOT IN (
           SELECT id FROM backups
            WHERE salao_id = $1
            ORDER BY created_at DESC
            LIMIT $2
         )
       RETURNING id`,
    [salaoId, keep]
  );
  return r.rowCount;
}

/**
 * Job diário — chama runBackup pra cada salão ativo.
 * Idempotente: se já rodou hoje (tipo='auto'), pula.
 */
async function runDailyForAllSaloes() {
  const { rows: saloes } = await pool.query(
    `SELECT id FROM saloes WHERE COALESCE(ativo, true) = true`
  );
  const resultados = [];
  for (const s of saloes) {
    const exists = await pool.query(
      `SELECT 1 FROM backups
        WHERE salao_id = $1 AND tipo = 'auto'
          AND DATE(created_at) = CURRENT_DATE
          AND status = 'ok'
        LIMIT 1`,
      [s.id]
    );
    if (exists.rows.length) {
      resultados.push({ salao_id: s.id, skip: true, reason: 'ja-tem-backup-hoje' });
      continue;
    }
    const r = await runBackup({ salaoId: s.id, tipo: 'auto', criadoPor: null });
    await applyRetention({ salaoId: s.id, keep: 14 }).catch(() => {});
    resultados.push({ salao_id: s.id, ...r });
  }
  return resultados;
}

let _intervalHandle = null;
/**
 * Inicia o agendador interno (setInterval 24h, primeiro disparo em ~5min).
 * Idempotente — múltiplas chamadas reusam o mesmo handle.
 */
function startScheduler() {
  if (_intervalHandle) return;
  // Primeiro disparo em 5 min (dá tempo do app subir e migrações rodarem).
  setTimeout(() => {
    runDailyForAllSaloes()
      .then((r) => console.log('[BACKUP] auto-run inicial:', r.length, 'salões processados'))
      .catch((e) => console.error('[BACKUP] auto-run inicial falhou:', e.message));
  }, 5 * 60 * 1000);
  // Depois a cada 24h.
  _intervalHandle = setInterval(() => {
    runDailyForAllSaloes()
      .then((r) => console.log('[BACKUP] auto-run diário:', r.length, 'salões processados'))
      .catch((e) => console.error('[BACKUP] auto-run diário falhou:', e.message));
  }, 24 * 60 * 60 * 1000);
}

function stopScheduler() {
  if (_intervalHandle) { clearInterval(_intervalHandle); _intervalHandle = null; }
}

module.exports = {
  runBackup,
  applyRetention,
  runDailyForAllSaloes,
  startScheduler,
  stopScheduler,
};
