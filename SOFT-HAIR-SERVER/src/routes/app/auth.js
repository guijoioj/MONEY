const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const ClienteApp = require('../../models/ClienteApp');
const Cliente = require('../../models/Cliente');
const { appAuthMiddleware } = require('../../middleware/appAuth');
const { query } = require('../../config/database');

function signClienteToken(cliente) {
  return jwt.sign(
    { clienteAppId: cliente.id, clienteId: cliente.id, email: cliente.email, nome: cliente.nome, type: 'cliente' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { nome, email, password, telefone } = req.body;
    if (!nome || !email || !password) return res.status(400).json({ error: 'nome, email e password são obrigatórios' });
    
    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres' });
    }
    
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password)) {
      return res.status(400).json({ error: 'Senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais' });
    }
    
    const existing = await ClienteApp.findByEmail(email);
    if (existing) return res.status(400).json({ error: 'Email já cadastrado' });
    const hashedPassword = await bcrypt.hash(password, 12);
    const cliente = await ClienteApp.create({ nome, email, password: hashedPassword, telefone });
    const token = signClienteToken(cliente);
    res.status(201).json({ user: ClienteApp.sanitize(cliente), token });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const cliente = await ClienteApp.findByEmail(email);
    if (!cliente) return res.status(401).json({ error: 'Credenciais inválidas' });
    const valid = await bcrypt.compare(password, cliente.password);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });
    const token = signClienteToken(cliente);
    res.json({ user: ClienteApp.sanitize(cliente), token });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/profissional/login', async (req, res) => {
  try {
    const AuthService = require('../../services/authService');
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);
    res.json(result);
  } catch (e) { res.status(401).json({ error: e.message }); }
});

router.get('/me', appAuthMiddleware, async (req, res) => {
  try {
    const cliente = await ClienteApp.findById(req.clienteApp.clienteAppId);
    if (!cliente) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ user: ClienteApp.sanitize(cliente) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/me', appAuthMiddleware, async (req, res) => {
  try {
    const { nome, telefone, foto } = req.body;
    const updates = {};
    if (nome) updates.nome = nome;
    if (telefone) updates.telefone = telefone;
    if (foto) updates.foto = foto;

    const cliente = await ClienteApp.update(req.clienteApp.clienteAppId, updates);

    const saloesVinculados = await query(
      'SELECT DISTINCT salao_id FROM clientes WHERE email = $1',
      [cliente.email]
    );
    for (const { salao_id: salaoId } of saloesVinculados) {
      const lista = await Cliente.getAll({ search: cliente.email }, salaoId);
      if (lista.length) {
        const campos = {};
        if (nome) campos.nome = nome;
        if (telefone) campos.telefone = telefone;
        await Cliente.update(lista[0].id, campos, salaoId);
      }
    }

    res.json({ user: ClienteApp.sanitize(cliente) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/me/senha', appAuthMiddleware, async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) return res.status(400).json({ error: 'senhaAtual e novaSenha são obrigatórios' });
    
    // Validate new password strength
    if (novaSenha.length < 8) {
      return res.status(400).json({ error: 'Nova senha deve ter no mínimo 8 caracteres' });
    }
    
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(novaSenha)) {
      return res.status(400).json({ error: 'Nova senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais' });
    }
    
    const cliente = await ClienteApp.findById(req.clienteApp.clienteAppId);
    if (!cliente) return res.status(404).json({ error: 'Usuário não encontrado' });
    const valid = await bcrypt.compare(senhaAtual, cliente.password);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });
    const hash = await bcrypt.hash(novaSenha, 12);
    await ClienteApp.update(req.clienteApp.clienteAppId, { password: hash });
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/me/push-token', appAuthMiddleware, async (req, res) => {
  try {
    const { pushToken } = req.body;
    await ClienteApp.update(req.clienteApp.clienteAppId, { pushToken });
    res.json({ message: 'Push token atualizado' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
