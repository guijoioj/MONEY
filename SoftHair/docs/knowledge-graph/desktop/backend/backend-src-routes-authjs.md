# backend/src/routes/auth.js

**Repository:** Desktop
**File:** `backend/src/routes/auth.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/routes/auth.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/sync|sync]]
- [[domains/security|security]]
- [[domains/api|api]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const AuthService = require('../services/authService');
const { validate } = require('../middleware/validate');
const { authMiddleware } = require('../middleware/auth');

router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
  body('name').trim().notEmpty().withMessage('Nome é obrigatório'),
], validate, async (req, res) => {
  try {
    const result = await AuthService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Senha é obrigatória'),
], validate, async (req, res) => {
  try {
    const result = await AuthService.login(req.body);
    res.json(result);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
], validate, async (req, res) => {
  try {
    const result = await AuthService.requestPasswordReset(req.body.email);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token é obrigatório'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres'),
], validate, async (req, res) => {
  try {
    const result = await AuthService.resetPassword(req.body.token, req.body.password);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/change-password', authMiddleware, [
  body('currentPassword').notEmpty().withMessage('Senha atual é obrigatória'),
  body('newPassword').isLength({ min: 6 }).withMessage('Nova senha deve ter no mínimo 6 caracteres'),
], validate, async (req, res) => {
  try {
    const result = await AuthService.changePassword(req.user.userId, req.body.currentPassword, req.body.newPassword);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
```
