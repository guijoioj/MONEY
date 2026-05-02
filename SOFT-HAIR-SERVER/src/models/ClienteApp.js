const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/database');

class ClienteApp {
  static async create(data) {
    const senhaHash = data.senha_hash || data.password;
    const row = await queryOne(`
      INSERT INTO clientes (nome, email, telefone, senha_hash, app_ativo, ativo)
      VALUES ($1, $2, $3, $4, true, true)
      RETURNING *
    `, [data.nome, data.email, data.telefone || null, senhaHash || null]);
    return this.toAppShape(row);
  }

  static async findById(id) {
    return this.toAppShape(await queryOne('SELECT * FROM clientes WHERE id = $1', [id]));
  }

  static async findByEmail(email) {
    return this.toAppShape(await queryOne('SELECT * FROM clientes WHERE email = $1', [email]));
  }

  static async update(id, data) {
    const allowed = {
      nome: 'nome',
      telefone: 'telefone',
      foto: 'foto_url',
      foto_url: 'foto_url',
      pushToken: 'push_token',
      push_token: 'push_token',
      password: 'senha_hash',
      senha_hash: 'senha_hash'
    };
    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      const column = allowed[key];
      if (!column) continue;
      sets.push(`${column} = $${idx++}`);
      values.push(value);
    }

    if (!sets.length) return this.findById(id);

    values.push(id);
    const row = await queryOne(`
      UPDATE clientes SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${idx}
      RETURNING *
    `, values);
    return this.toAppShape(row);
  }

  static async setPassword(id, password) {
    const senhaHash = await bcrypt.hash(password, 12);
    return this.update(id, { senha_hash: senhaHash });
  }

  static toAppShape(row) {
    if (!row) return null;
    return {
      ...row,
      password: row.senha_hash,
      pushToken: row.push_token,
      updatedAt: row.updated_at,
      createdAt: row.created_at
    };
  }

  static sanitize(user) {
    if (!user) return null;
    const { password, senha_hash, ...sanitized } = user;
    return sanitized;
  }
}

module.exports = ClienteApp;
