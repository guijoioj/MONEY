# backend/src/services/backupService.js

**Repository:** Desktop
**File:** `backend/src/services/backupService.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `backend/src/services/backupService.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/servicos|servicos]]
- [[domains/produtos|produtos]]
- [[domains/vendas|vendas]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/mobile-ui|mobile-ui]]
- [[domains/state|state]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { query, queryRun } = require('../config/database');
const googleDriveService = require('./googleDriveService');
const { getPaths, ensureRuntimeDirs } = require('../config/appPaths');

const { backupDir } = getPaths();
ensureRuntimeDirs();

class BackupService {
  static backupPath = backupDir;

  static ensureBackupDir() {
    if (!fs.existsSync(this.backupPath)) {
      fs.mkdirSync(this.backupPath, { recursive: true });
    }
  }

  static async createBackup() {
    this.ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.json`;
    const filepath = path.join(this.backupPath, filename);

    const [users, clientes, servicos, produtos, agendamentos, vendas, vendasItens] = await Promise.all([
      query('SELECT * FROM users'),
      query('SELECT * FROM clientes'),
      query('SELECT * FROM servicos'),
      query('SELECT * FROM produtos'),
      query('SELECT * FROM agendamentos'),
      query('SELECT * FROM vendas'),
      query('SELECT * FROM vendas_itens'),
    ]);

    const backupData = {
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      database: { users, clientes, servicos, produtos, agendamentos, vendas, vendas_itens: vendasItens }
    };

    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));

    await queryRun(
      'INSERT INTO backup_metadata (id, filename, filepath, size) VALUES (?, ?, ?, ?)',
      [uuidv4(), filename, filepath, fs.statSync(filepath).size]
    );

    return { filename, filepath, size: fs.statSync(filepath).size, createdAt: backupData.createdAt };
  }

  static async restoreBackup(filepath) {
    if (!fs.existsSync(filepath)) throw new Error('Arquivo de backup não encontrado');

    const backupData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    if (!backupData.version || !backupData.database) throw new Error('Arquivo de backup inválido');

    await queryRun('DELETE FROM vendas_itens');
    await queryRun('DELETE FROM vendas');
    await queryRun('DELETE FROM agendamentos');
    await queryRun('DELETE FROM produtos');
    await queryRun('DELETE FROM servicos');
    await queryRun('DELETE FROM clientes');
    await queryRun('DELETE FROM users');

    const db = backupData.database;

    for (const u of (db.users || [])) {
      await queryRun('INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)', [u.id, u.email, u.password, u.name, u.role || 'admin']);
    }
    for (const c of (db.clientes || [])) {
      await queryRun('INSERT INTO clientes (id, nome, email, telefone, cpf, "dataNascimento", endereco, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [c.id, c.nome, c.email, c.telefone, c.cpf, c.dataNascimento, c.endereco, c.observacoes]);
    }
    for (const s of (db.servicos || [])) {
      await queryRun('INSERT INTO servicos (id, nome, descricao, duracao, preco, categoria, ativo) VALUES (?, ?, ?, ?, ?, ?, ?)', [s.id, s.nome, s.descricao, s.duracao, s.preco, s.categoria, s.ativo !== undefined ? s.ativo : 1]);
    }
    for (const p of (db.produtos || [])) {
      await queryRun('INSERT INTO produtos (id, nome, descricao, marca, categoria, "precoVenda", estoque, "estoqueMinimo", ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [p.id, p.nome, p.descricao, p.marca, p.categoria, p.precoVenda, p.estoque || 0, p.estoqueMinimo || 0, p.ativo !== undefined ? p.ativo : 1]);
    }
    for (const a of (db.agendamentos || [])) {
      await queryRun('INSERT INTO agendamentos (id, "clienteId", "servicoId", "dataHora", duracao, status) VALUES (?, ?, ?, ?, ?, ?)', [a.id, a.clienteId, a.servicoId, a.dataHora, a.duracao, a.status || 'agendado']);
    }
    for (const v of (db.vendas || [])) {
      await queryRun('INSERT INTO vendas (id, "clienteId", data, total, "formaPagamento") VALUES (?, ?, ?, ?, ?)', [v.id, v.clienteId, v.data, v.total, v.formaPagamento]);
    }
    for (const vi of (db.vendas_itens || [])) {
      await queryRun('INSERT INTO vendas_itens (id, "vendaId", tipo, "itemId", quantidade, "precoUnitario", subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)', [vi.id, vi.vendaId, vi.tipo, vi.itemId, vi.quantidade, vi.precoUnitario, vi.subtotal]);
    }

    return { success: true, message: 'Backup restaurado com sucesso' };
  }

  static getLocalBackups() {
    this.ensureBackupDir();
    if (!fs.existsSync(this.backupPath)) return [];
    return fs.readdirSync(this.backupPath)
      .filter(f => f.endsWith('.json') && f.startsWith('backup_'))
      .map(f => {
        const fp = path.join(this.backupPath, f);
        const stats = fs.statSync(fp);
        return { filename: f, filepath: fp, size: stats.size, createdAt: stats.birthtime };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static async restoreBackupFromFilename(filename) {
    const filepath = path.join(this.backupPath, filename);
    return this.restoreBackup(filepath);
  }

  static async syncToCloud(filename) {
    const filepath = path.join(this.backupPath, filename);
    if (!fs.existsSync(filepath)) throw new Error('Arquivo de backup não encontrado');
    return googleDriveService.uploadFile(filepath, filename);
  }

  static async getCloudBackups() {
    return googleDriveService.listFiles();
  }

  static async downloadFromCloud(fileId, filename) {
    const filepath = path.join(this.backupPath, filename);
    await googleDriveService.downloadFile(fileId, filepath);
    return filepath;
  }
}

module.exports = BackupService;
```
