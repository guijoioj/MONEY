/**
 * Script: migrate-servicos-to-produtos.js
 *
 * Move registros que são PRODUTOS (não serviços) da tabela `servicos`
 * para a tabela `produtos`.
 *
 * Critério de identificação: nome contém palavras/padrões típicos de produto
 * ou a string "VENDA" (indica item vendido, não serviço prestado).
 *
 * Uso: node tools/migrate-servicos-to-produtos.js [--dry-run]
 */

const { Pool } = require('pg');

const DB_URL = 'postgresql://db_softhair_user:<REDACTED_DB_PASSWORD>@dpg-d7o0fcdckfvc73fabqlg-a.ohio-postgres.render.com/db_softhair';

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});

const DRY_RUN = process.argv.includes('--dry-run');

// Regex que identifica nomes que são produtos (não serviços)
// Padrões: "VENDA", ml/g com quantidade, nomes de produtos cosméticos
const PRODUTO_REGEX = /\bVENDA\b|\d+\s*ml\b|\d+\s*g\b|shampoo|condicionador|máscara|mascara|creme\b|loção|locao|loçao|\bkit\b|serum|sérum|óleo\b|oleo\b|tônico|tonico|hidratante|ampola|ampolha|finalizador|\bspray\b|\bmousse\b|\bgel\b|\bwax\b|\bpomada\b|\bbalm\b|leave.in|protetor\b|termoativo|elixir|reparador|reconstrutora|reconstrutor|botox capilar|\bgloss\b|\btintura\b|\boxidante\b|\bdescolorante\b|\bpó descolorante\b|\btoner\b|\btôner\b|\bmatizador\b|\btratamento\b|\bcápsulas\b|\bcapsulas\b|\bsuplemento\b|\bcolágeno\b|\bcolagenoativo\b|ADM - CAFÉ|UI\b/i;

async function run() {
  const client = await pool.connect();
  try {
    // Buscar todos os serviços com nome
    const servicos = await client.query(
      `SELECT * FROM servicos WHERE nome IS NOT NULL AND nome ~ '[a-zA-Z]' ORDER BY nome`
    );

    const candidatos = servicos.rows.filter(s => PRODUTO_REGEX.test(s.nome));

    console.log(`\nTotal servicos com nome: ${servicos.rows.length}`);
    console.log(`Candidatos a produto: ${candidatos.length}`);
    if (DRY_RUN) {
      console.log('\n--- DRY RUN (nenhuma alteração será feita) ---\n');
      candidatos.slice(0, 50).forEach(s => console.log(`  [${s.id}] ${s.nome} | R$${s.preco}`));
      if (candidatos.length > 50) console.log(`  ... e mais ${candidatos.length - 50}`);
      await client.release();
      await pool.end();
      return;
    }

    // Verificar colunas da tabela produtos para mapear corretamente
    // produtos: id, salao_id, nome, descricao, preco_custo, preco_venda, quantidade_estoque,
    //           quantidade_minima, categoria, codigo_barras, ativo, created_at, updated_at

    let inserted = 0;
    let deleted = 0;

    await client.query('BEGIN');

    for (const s of candidatos) {
      // Inserir em produtos
      await client.query(`
        INSERT INTO produtos (salao_id, nome, descricao, preco_custo, preco_venda, quantidade_estoque, quantidade_minima, categoria, ativo, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT DO NOTHING
      `, [
        s.salao_id,
        s.nome.trim(),
        s.descricao || null,
        s.preco || 0,          // preco_custo
        s.preco || 0,          // preco_venda
        0,                     // quantidade_estoque
        0,                     // quantidade_minima
        'Importado',           // categoria
        s.ativo !== false,
        s.created_at,
        s.updated_at,
      ]);
      inserted++;

      // Remover de servicos
      await client.query(`DELETE FROM servicos WHERE id = $1`, [s.id]);
      deleted++;
    }

    await client.query('COMMIT');

    console.log(`\nMigracao concluida:`);
    console.log(`  Inseridos em produtos: ${inserted}`);
    console.log(`  Removidos de servicos: ${deleted}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERRO — rollback efetuado:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
