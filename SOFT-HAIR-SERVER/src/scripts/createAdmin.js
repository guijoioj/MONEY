require('dotenv').config();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Salao = require('../models/Salao');
const { pool } = require('../config/database');
const { initDb } = require('../config/initDb');

async function createAdmin() {
  const email = process.argv[2] || process.env.SOFTHAIR_DEFAULT_ADMIN_EMAIL || 'admin@salao.com';
  // [P7-B1] Sem fallback inseguro — exige senha explícita via argv[3] ou env.
  // Senha mínima de 10 caracteres para evitar default fraco em staging/dev exposto.
  const password = process.argv[3] || process.env.SOFTHAIR_DEFAULT_ADMIN_PASSWORD;
  const name = process.argv[4] || 'Administrador';

  if (!password) {
    console.error('❌ Senha obrigatória.');
    console.error('   Uso: node createAdmin.js <email> <senha> [nome]');
    console.error('   OU defina SOFTHAIR_DEFAULT_ADMIN_PASSWORD (>=10 chars) no ambiente.');
    process.exit(1);
  }

  if (password.length < 10) {
    console.error(`❌ Senha muito curta (${password.length} chars). Mínimo 10 caracteres.`);
    process.exit(1);
  }

  try {
    console.log('Inicializando banco de dados...');
    await initDb();

    console.log('Verificando se usuário já existe...');
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      console.log(`Usuário ${email} já existe.`);
      process.exit(0);
    }

    console.log('Buscando ou criando salão padrão...');
    let salao = await Salao.findFirst();
    if (!salao) {
      console.log('Criando salão padrão...');
      salao = await Salao.create({
        nome: 'Meu Salão',
        email: email
      });
      console.log(`Salão criado: ${salao.id}`);
    }

    console.log('Criando usuário admin...');
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      role: 'admin',
      salonId: salao.id
    });

    console.log('Admin criado com sucesso!');
    console.log(`Email: ${email}`);
    console.log(`Senha: ${password}`);
    console.log(`Salão ID: ${salao.id}`);
  } catch (error) {
    console.error('Erro ao criar admin:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdmin();
