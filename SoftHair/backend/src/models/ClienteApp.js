const { v4: uuidv4 } = require('uuid');
const { query, queryOne, queryRun } = require('../config/database');

class ClienteApp {
  static async create(data) {
    const id = uuidv4();
    await queryRun(
      'INSERT INTO clientes_app (id, nome, email, password, telefone) VALUES (?, ?, ?, ?, ?)',
      [id, data.nome, data.email, data.password, data.telefone||null]
    );
    return this.findById(id);
  }

  static async findById(id) {
    return queryOne('SELECT * FROM clientes_app WHERE id = ?', [id]);
  }

  static async findByEmail(email) {
    return queryOne('SELECT * FROM clientes_app WHERE email = ?', [email]);
  }

  static async update(id, data) {
    const fields = [], values = [];
    const allowed = ['nome', 'telefone', 'foto', 'pushToken'];
    for (const [k, v] of Object.entries(data)) {
      if (allowed.includes(k)) { fields.push(`"${k}" = ?`); values.push(v); }
    }
    if (!fields.length) return this.findById(id);
    fields.push('"updatedAt" = NOW()');
    values.push(id);
    await queryRun(`UPDATE clientes_app SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static sanitize(user) {
    if (!user) return null;
    const { password, ...sanitized } = user;
    return sanitized;
  }
}

module.exports = ClienteApp;
