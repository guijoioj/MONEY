#!/usr/bin/env node
/**
 * Test Client para SOFT-HAIR-SERVER
 */

const axios = require('axios');

async function testServer() {
  const baseURL = 'http://localhost:3000/api';
  
  console.log('🧪 Testando SOFT-HAIR-SERVER...\n');
  
  try {
    // Test server health
    console.log('1️⃣ Testando /health');
    const health = await axios.get(`${baseURL}/health`);
    console.log('✅ Server OK:', health.data);
    
    // Test auth
    console.log(\n2️⃣ Testando /auth');
    const authBody = {
      nome: "Salão Teste",
      email: "teste@teste.com", 
      adminEmail: "admin@teste.com",
      adminSenha: "12345678",
      adminNome: "Admin Teste"
    };
    
    try {
      const register = await axios.post(`${baseURL}/auth/register`, authBody);
      console.log('✅ Registro OK');
    } catch (err) {
      console.log('⚠️ Registro falhou (talvez já existe)', err.response?.data);
    }
    
    // Test login
    console.log(\n3️⃣ Testando login');
    const login = await axios.post(`${baseURL}/auth/login`, {
      email: "admin@teste.com",
      senha: "12345678"
    });
    console.log('✅ Login OK, token:', login.data.data.token?.substring(0,10)+'...');
    
    const token = login.data.data.token;
    
    // Test with auth
    const authClient = axios.create({ baseURL, headers: { Authorization: 'Bearer '+token } }); 
    
    // Test CRUD
    console.log(\n4️⃣ Testando CRUD basico');
    
    // Create
    const cliente = await authClient.post('/clientes', {
      nome: 'Cliente Teste',
      telefone: '(11) 99999-0001'
    });
    console.log('✅ Cliente criado:', cliente.data.data.id);
    
    // List
    const listagem = await authClient.get('/clientes');
    console.log('✅ Listando clientes (total:', listagem.data.data.length +')');
    
    // Update
    const updated = await authClient.put(`/clientes/${cliente.data.data.id}`, {
      nome: 'Cliente Teste 2',
      email: 'novo@email.com'
    });
    console.log('✅ Cliente atualizado');
    
    // Search
    const search = await authClient.get(`/clientes/search/Cliente`);
    console.log('✅ Busca por termo (encontrados:', search.data.data.length +')');
    
    // 5️⃣ Testar sync
  console.log(\n5️⃣ Testando sync');
    const sync = await authClient.get('/sync/changes?since=2024-01-01T00:00:00.000Z');
 console.log('✅ Sync changes retrieved');
    
    console.log('\n✅ Todos os testes passaram!\n');
    
  } catch (error) {
    console.error('❌ Erro nos testes:', error.message);
    if (error.response) {
  console.error('Response error:', error.response.data);
    }
  }
}

// Testar conexão PostgreSQL
console.log(((process.env.CONTEXT_SECRET ||\'

console.log(process.env.NODE_ENV||'\') || 'production') + ' mode').toUpperCase().replace(/PRODUCTION/,'Production').replace(/DEVELOPMENT/,'Development'));

if (process.env.CONTEXT_SECRET && process.env.CONTEXT_SECRET.startsWith('postgresql://')) {
  console.log('PostgreSQL URL found in env');
} else {
  console.log('PostgreSQL URL: postgresql://softhair:softhair123@localhost:5432/softhair_central');
}

testServer();