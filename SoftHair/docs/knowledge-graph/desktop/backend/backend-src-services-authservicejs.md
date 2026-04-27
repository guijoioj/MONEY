# backend/src/services/authService.js

**Repository:** Desktop
**File:** `backend/src/services/authService.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/services/authService.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/api|api]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const emailService = require('./emailService');
const BootstrapService = require('./bootstrapService');

class AuthService {
  static async register({ email, password, name, salonId }) {
    const existingUser = await User.findByEmail(email);
    if (existingUser) throw new Error('Email já cadastrado');
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password: hashedPassword, name, salonId });
    const token = this.generateToken(user);
    return { user: this.sanitizeUser(user), token };
  }

  static async login({ email, password }) {
    const user = await User.findByEmail(email);
    if (!user) throw new Error('Credenciais inválidas');
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) throw new Error('Credenciais inválidas');
    const token = this.generateToken(user);
    return { user: this.sanitizeUser(user), token };
  }

  static generateToken(user) {
    const { secret, expiresIn } = BootstrapService.getJwtConfig();
    return jwt.sign(
      { id: user.id, userId: user.id, email: user.email, role: user.role, salonId: user.salonId, profissionalId: user.profissionalId },
      secret,
      { expiresIn }
    );
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, BootstrapService.getJwtConfig().secret);
    } catch {
      throw new Error('Token inválido ou expirado');
    }
  }

  static async getUserById(userId) {
    return User.findById(userId);
  }

  static async requestPasswordReset(email) {
    const user = await User.findByEmail(email);
    if (!user) throw new Error('Usuário não encontrado');
    const resetToken = uuidv4();
    await User.setResetToken(user.id, resetToken, Date.now() + 3600000);
    await emailService.sendPasswordResetEmail(email, resetToken, user.name);
    return { message: 'Email de recuperação enviado' };
  }

  static async resetPassword(token, newPassword) {
    const user = await User.findByResetToken(token);
    if (!user) throw new Error('Token inválido ou expirado');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await User.update(user.id, { password: hashedPassword });
    await User.clearResetToken(user.id);
    return { message: 'Senha alterada com sucesso' };
  }

  static sanitizeUser(user) {
    const { password, resetToken, resetTokenExpiry, ...sanitized } = user;
    return sanitized;
  }

  static async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId);
    if (!user) throw new Error('Usuário não encontrado');
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) throw new Error('Senha atual incorreta');
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await User.update(userId, { password: hashedPassword });
    return { message: 'Senha alterada com sucesso' };
  }
}

module.exports = AuthService;
```
