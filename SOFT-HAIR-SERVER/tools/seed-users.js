/**
 * tools/seed-users.js
 *
 * Cria/atualiza usuários do sistema para cada profissional ativo + 1 usuário de recepção.
 *
 * - Profissional: email = primeironome@<salao_dominio> (lowercase, sem acento)
 *                 senha  = profissional_123
 *                 tipo   = 'profissional'
 *                 profissional_id = id do registro
 * - Recepção:    email = recepcao@<salao_dominio>
 *                 senha = MT_recepção
 *                 tipo  = 'recepcao'
 *
 * Idempotente: se o usuário já existe, atualiza tipo + profissional_id + senha (resetando token_version).
 *
 * Uso:
 *   DATABASE_URL=postgres://... node tools/seed-users.js
 *   DATABASE_URL=postgres://... node tools/seed-users.js --salao=1
 *   DATABASE_URL=postgres://... node tools/seed-users.js --dry-run
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query, queryOne } = require('../src/config/database');

const BCRYPT_COST = 12;
const SENHA_PROFISSIONAL = 'profissional_123';
const SENHA_RECEPCAO = 'MT_recepção';

function slugify(s) {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function parseArgs() {
  const args = { dryRun: false, salaoFilter: null };
  for (const a of process.argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--salao=')) args.salaoFilter = parseInt(a.split('=')[1], 10);
  }
  return args;
}

async function upsertUsuario({ email, nome, tipo, senha, salaoId, profissionalId, dryRun }) {
  const existing = await queryOne(
    'SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) AND salao_id = $2',
    [email, salaoId]
  );

  if (dryRun) {
    console.log(`  [dry] ${existing ? 'UPDATE' : 'INSERT'} ${tipo.padEnd(13)} ${email}`);
    return { id: existing?.id || null, action: existing ? 'updated' : 'created' };
  }

  const senha_hash = await bcrypt.hash(senha, BCRYPT_COST);

  if (existing) {
    await query(
      `UPDATE usuarios
          SET nome = $1, tipo = $2, profissional_id = $3, senha_hash = $4, ativo = true,
              token_version = COALESCE(token_version,0)+1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5`,
      [nome, tipo, profissionalId, senha_hash, existing.id]
    );
    return { id: existing.id, action: 'updated' };
  }
  const created = await queryOne(
    `INSERT INTO usuarios (email, nome, tipo, senha_hash, salao_id, profissional_id, ativo)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING id`,
    [email, nome, tipo, senha_hash, salaoId, profissionalId]
  );
  return { id: created.id, action: 'created' };
}

(async function main() {
  const { dryRun, salaoFilter } = parseArgs();
  console.log('SoftHair · seed-users');
  console.log('-------------------------------------');
  if (dryRun) console.log('Modo: DRY RUN (não grava nada)');
  console.log('');

  // Lista salões alvo
  const saloesSql = salaoFilter
    ? 'SELECT id, nome FROM saloes WHERE id = $1 AND ativo = true'
    : 'SELECT id, nome FROM saloes WHERE ativo = true';
  const saloesParams = salaoFilter ? [salaoFilter] : [];
  const saloes = await query(saloesSql, saloesParams);

  if (!saloes.length) {
    console.error('Nenhum salão encontrado.');
    process.exit(1);
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  // Coleta credenciais para imprimir ao final (mais útil pro admin que vai distribuir).
  const credenciais = [];

  for (const salao of saloes) {
    const dominio = slugify(salao.nome) || `salao${salao.id}`;
    console.log(`Salão #${salao.id} — ${salao.nome}  (dom: ${dominio})`);

    // Profissionais ativos
    const profissionais = await query(
      `SELECT id, nome FROM profissionais
        WHERE salao_id = $1 AND COALESCE(ativo, true) = true
        ORDER BY nome`,
      [salao.id]
    );

    // Garantir emails únicos: se houver homônimos, anexar id.
    const usados = new Set();
    for (const prof of profissionais) {
      const primeiro = slugify((prof.nome || '').split(/\s+/)[0]);
      if (!primeiro) {
        console.log(`  [skip] profissional #${prof.id} sem nome utilizável`);
        continue;
      }
      let email = `${primeiro}@${dominio}`;
      if (usados.has(email.toLowerCase())) email = `${primeiro}${prof.id}@${dominio}`;
      usados.add(email.toLowerCase());

      const r = await upsertUsuario({
        email,
        nome: prof.nome,
        tipo: 'profissional',
        senha: SENHA_PROFISSIONAL,
        salaoId: salao.id,
        profissionalId: prof.id,
        dryRun,
      });
      if (r.action === 'created') totalCreated++; else totalUpdated++;
      credenciais.push({
        salao: salao.nome,
        nome: prof.nome,
        email,
        senha: SENHA_PROFISSIONAL,
        tipo: 'profissional',
      });
    }

    // Recepção
    const emailRecepcao = `recepcao@${dominio}`;
    const r = await upsertUsuario({
      email: emailRecepcao,
      nome: 'Recepção',
      tipo: 'recepcao',
      senha: SENHA_RECEPCAO,
      salaoId: salao.id,
      profissionalId: null,
      dryRun,
    });
    if (r.action === 'created') totalCreated++; else totalUpdated++;
    credenciais.push({
      salao: salao.nome,
      nome: 'Recepção',
      email: emailRecepcao,
      senha: SENHA_RECEPCAO,
      tipo: 'recepcao',
    });
  }

  console.log('');
  console.log('-------------------------------------');
  console.log(`Criados:    ${totalCreated}`);
  console.log(`Atualizados: ${totalUpdated}`);
  console.log('');
  console.log('CREDENCIAIS:');
  for (const c of credenciais) {
    console.log(`  [${c.tipo.padEnd(13)}] ${c.nome.padEnd(28)} ${c.email.padEnd(40)} ${c.senha}`);
  }
  console.log('');
  console.log('IMPORTANTE: imprima/distribua essas credenciais e instrua cada usuário a trocar a senha no primeiro acesso.');

  await pool.end();
  process.exit(0);
})().catch((err) => {
  console.error('Falha no seed-users:', err);
  process.exit(1);
});
