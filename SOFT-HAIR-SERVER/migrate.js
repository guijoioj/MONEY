require('dotenv').config();
const { pool } = require('./src/config/database');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create new table
    await client.query(`
      CREATE TABLE IF NOT EXISTS comissoes_pagamentos (
        id SERIAL PRIMARY KEY,
        salao_id INTEGER REFERENCES saloes(id) ON DELETE CASCADE,
        profissional_id INTEGER REFERENCES profissionais(id) ON DELETE CASCADE,
        valor DECIMAL(10,2) NOT NULL,
        data_pagamento DATE NOT NULL,
        observacoes TEXT,
        motivo_estorno TEXT,
        status VARCHAR(50) DEFAULT 'pago',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ Tabela comissoes_pagamentos criada');

    // Check if column exists, if not add it
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='comissoes' AND column_name='pagamento_id';
    `);

    if (res.rows.length === 0) {
      await client.query(`
        ALTER TABLE comissoes 
        ADD COLUMN pagamento_id INTEGER REFERENCES comissoes_pagamentos(id) ON DELETE SET NULL;
      `);
      console.log('✅ Coluna pagamento_id adicionada à tabela comissoes');
    } else {
      console.log('ℹ️ Coluna pagamento_id já existe na tabela comissoes');
    }

    // Adicionar colunas de auth mobile na tabela clientes
    const colSenha = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='clientes' AND column_name='senha_hash';
    `);
    if (colSenha.rows.length === 0) {
      await client.query(`ALTER TABLE clientes ADD COLUMN senha_hash VARCHAR(255);`);
      console.log('✅ Coluna senha_hash adicionada à tabela clientes');
    } else {
      console.log('ℹ️ Coluna senha_hash já existe na tabela clientes');
    }

    const colAtivo = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name='clientes' AND column_name='app_ativo';
    `);
    if (colAtivo.rows.length === 0) {
      await client.query(`ALTER TABLE clientes ADD COLUMN app_ativo BOOLEAN DEFAULT false;`);
      console.log('✅ Coluna app_ativo adicionada à tabela clientes');
    } else {
      console.log('ℹ️ Coluna app_ativo já existe na tabela clientes');
    }

    await client.query('COMMIT');
    console.log('🎉 Migração concluída com sucesso!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migração:', error);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
