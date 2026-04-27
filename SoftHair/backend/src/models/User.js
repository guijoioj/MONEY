const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryRun } = require('../config/database');

class User {
  static async create({ email, password, name, role = 'admin', salonId = null, profissionalId = null }) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO users (id, email, password, name, role, "salonId", "profissionalId") VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, email, password, name, role, salonId, profissionalId]
    );
    return this.findById(id);
  }

  static async findById(id) {
    return queryOne('SELECT * FROM users WHERE id = ?', [id]);
  }

  static async count() {
    const row = await queryOne('SELECT COUNT(*) as total FROM users');
    return parseInt(row?.total || 0);
  }

  static async findByEmail(email) {
    return queryOne('SELECT * FROM users WHERE email = ?', [email]);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    const allowed = ['email', 'password', 'name', 'resetToken', 'resetTokenExpiry', 'salonId', 'profissionalId'];
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && allowed.includes(k)) { fields.push(`"${k}" = ?`); values.push(v); }
    }
    if (!fields.length) return this.findById(id);
    fields.push('"updatedAt" = NOW()');
    values.push(id);
    await queryRun(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async findByResetToken(token) {
    return queryOne('SELECT * FROM users WHERE "resetToken" = ? AND "resetTokenExpiry" > NOW()', [token]);
  }

  static async setResetToken(id, token, expiry) {
    await queryRun('UPDATE users SET "resetToken" = ?, "resetTokenExpiry" = ? WHERE id = ?', [token, new Date(Date.now() + 3600000).toISOString(), id]);
  }

  static async clearResetToken(id) {
    await queryRun('UPDATE users SET "resetToken" = NULL, "resetTokenExpiry" = NULL WHERE id = ?', [id]);
  }

  static async getAll() {
    return query('SELECT id, email, name, role, "salonId", "profissionalId", "createdAt", "updatedAt" FROM users');
  }
}

module.exports = User;
