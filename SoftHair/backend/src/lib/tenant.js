/**
 * Validação cross-tenant para foreign keys (Pass 3 P3-C4).
 *
 * Routes que aceitam IDs de relacionamento (cliente_id, profissional_id,
 * servico_id, produto_id) precisam validar que esses IDs pertencem ao mesmo
 * salao_id do usuário autenticado. Sem isso, atacante com token de salão 1
 * cria agendamentos referenciando cliente_id=42 (que é do salão 2).
 *
 * Em SQLite single-tenant local, é low-risk hoje (só existe salaoId=1).
 * Mas o backend embarcado compartilha código com o cloud (multi-tenant
 * Postgres), e se um dia for usado em multi-tenant SQLite a falha vira ativa.
 */

const { queryOne } = require('../config/database');

const TABLE_HAS_SALAO_ID = new Set([
  'clientes', 'profissionais', 'servicos', 'produtos',
  'agendamentos', 'atendimentos', 'vendas',
]);

/**
 * Valida que um ID pertence ao salão informado.
 * @param {string} table — nome da tabela (deve ter coluna salao_id)
 * @param {number|string} id — id do registro
 * @param {number} salaoId — salao_id esperado (extraído do JWT)
 * @returns {Promise<boolean>} true se passa, false se ID não existe ou é de outro salão
 */
async function belongsToSalao(table, id, salaoId) {
  if (id === null || id === undefined || id === '') return true; // FK opcional
  if (!TABLE_HAS_SALAO_ID.has(table)) {
    throw new Error(`belongsToSalao: tabela não suportada: ${table}`);
  }
  const row = await queryOne(
    `SELECT salao_id FROM ${table} WHERE id = ?`,
    [id]
  );
  if (!row) return false;
  return Number(row.salao_id) === Number(salaoId);
}

/**
 * Valida vários IDs em lote. Retorna o primeiro que falhou (ou null se ok).
 * @param {Array<{table: string, id: any}>} refs
 * @param {number} salaoId
 * @returns {Promise<{table, id}|null>}
 */
async function validateFKs(refs, salaoId) {
  for (const { table, id } of refs) {
    if (id === null || id === undefined || id === '') continue;
    const ok = await belongsToSalao(table, id, salaoId);
    if (!ok) return { table, id };
  }
  return null;
}

module.exports = { belongsToSalao, validateFKs, TABLE_HAS_SALAO_ID };
