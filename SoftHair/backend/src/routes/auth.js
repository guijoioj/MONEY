const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { query, queryOne, queryRun, withTransaction, dbType } = require('../config/database');
const { authMiddleware, generateToken } = require('../middleware/auth');
const { isStrongPassword } = require('../lib/passwords');

// P3-C2: rate-limit anti-brute-force.
// 5 tentativas / 15 min por IP em /login. Pesos: limite curto.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  skipSuccessfulRequests: true,
});

// P3-C2: setup endpoints menos sensíveis mas vale limitar pra evitar enumeration.
const setupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas requisições. Tente novamente em 1 minuto.' },
});

// E4: setup endpoint público — apenas quando não há admins ainda.
// Permite o app criar o primeiro admin via UI (setup wizard) com senha forte.
// P3-C2: setupLimiter — 10/min para evitar enumeration.
router.get('/needs-setup', setupLimiter, async (req, res) => {
  try {
    // P4-A7: contar TODOS os usuários (ativo=1 OU ativo=0) — coerente com
    // re-check em /bootstrap-admin. Banco que já teve admin não permite
    // re-bootstrap mesmo se admin foi soft-deleted.
    const row = await queryOne(`SELECT COUNT(*) as n FROM usuarios`);
    res.json({ success: true, data: { needsSetup: !row || (row.n || 0) === 0 } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/bootstrap-admin', setupLimiter, [
  body('email').isEmail().withMessage('Email inválido'),
  body('senha').custom((value) => {
    if (!isStrongPassword(value)) {
      // P2-A6: mensagem genérica de regra, sem leak da lista de comuns.
      throw new Error('Senha fraca: use 8+ caracteres com maiúscula, minúscula e número');
    }
    return true;
  }),
  body('nome').notEmpty().withMessage('Nome é obrigatório'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, senha, nome } = req.body;
    const senha_hash = await bcrypt.hash(senha, 10);

    // P2-A7: bootstrap atomic — usa transação para garantir que apenas UM admin
    // possa ser criado mesmo em concorrência. Re-checa dentro da transação.
    // P4-A7: contar TODOS os usuários (mesmo ativo=0). Senão, atacante que
    // consegue UPDATE usuarios SET ativo=0 (ou recover usuário antigo) consegue
    // re-bootstrap e criar admin novo. Bootstrap só roda em banco truly fresh.
    // P7-A10: além do COUNT+INSERT dentro da transação, fazemos um INSERT condicional
    // (WHERE NOT EXISTS) — em SQLite WAL com 2 requests paralelos, COUNT pode dar 0
    // em ambos antes do primeiro commit. Com `WHERE NOT EXISTS`, o segundo INSERT
    // simplesmente não insere (0 rows changed), garantindo atomicidade real.
    const result = await withTransaction(async (client) => {
      const checkRes = await client.query(
        `SELECT COUNT(*) as n FROM usuarios`,
        []
      );
      // PG retorna { rows: [{n}] }; SQLite wrap retorna { rows: [{n}] }
      const row = checkRes.rows ? checkRes.rows[0] : checkRes;
      const count = Number(row?.n || 0);
      if (count > 0) {
        return { ok: false, code: 403, error: 'Setup já concluído' };
      }
      const salaoRes = await client.query(
        `SELECT id FROM saloes ORDER BY id LIMIT 1`,
        []
      );
      const salaoRow = (salaoRes.rows ? salaoRes.rows[0] : salaoRes);
      if (!salaoRow || !salaoRow.id) {
        return { ok: false, code: 500, error: 'Salão default não encontrado' };
      }
      // P7-A10: INSERT condicional. Se 2 requests paralelos chegam, apenas 1 insere.
      const insRes = await client.query(
        `INSERT INTO usuarios (email, senha_hash, nome, tipo, salao_id, ativo)
         SELECT ?, ?, ?, 'admin', ?, 1
         WHERE NOT EXISTS (SELECT 1 FROM usuarios)`,
        [email, senha_hash, nome, salaoRow.id]
      );
      // Em SQLite, queryRun wrap retorna { rowCount }. Em pg, idem.
      const inserted = Number(insRes?.rowCount ?? insRes?.changes ?? 0);
      if (inserted === 0) {
        return { ok: false, code: 409, error: 'Outra requisição criou o admin primeiro. Tente fazer login.' };
      }
      return { ok: true };
    });

    if (!result.ok) {
      return res.status(result.code).json({ success: false, error: result.error });
    }

    res.json({ success: true, message: 'Admin criado. Faça login.' });
  } catch (error) {
    // P2-A7: erro de UNIQUE (corrida real perdida) — retornar 409.
    if (error && /UNIQUE|duplicate key/i.test(error.message)) {
      return res.status(409).json({ success: false, error: 'Email já em uso' });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/login', loginLimiter, [
  body('email').isEmail().withMessage('Email inválido'),
  body('senha').notEmpty().withMessage('Senha é obrigatória'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, senha } = req.body;

    const user = await queryOne(
      `SELECT u.*, s.nome as salao_nome, s.ativo as salao_ativo
       FROM usuarios u
       JOIN saloes s ON s.id = u.salao_id
       WHERE u.email = ? AND u.ativo = 1`,
      [email]
    );

    if (!user) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    const valid = await bcrypt.compare(senha, user.senha_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
    }

    if (!user.salao_ativo) {
      return res.status(403).json({ success: false, error: 'Salão inativo' });
    }

    // Atualizar último acesso
    try {
      await query(`UPDATE usuarios SET ultimo_acesso = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`, [user.id]);
    } catch {}

    const token = generateToken(user);

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          nome: user.nome,
          tipo: user.tipo,
          salao_id: user.salao_id,
          salao_nome: user.salao_nome,
        },
      },
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT u.id, u.email, u.nome, u.tipo, u.salao_id, s.nome as salao_nome
       FROM usuarios u
       JOIN saloes s ON s.id = u.salao_id
       WHERE u.id = ?`,
      [req.user.userId]
    );
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// P5-A2: LGPD art. 18 — exclusão de dados.
// User confirma com senha; o backend purga todos os dados do salão local.
//  - DROP rows de todas as tabelas de dados (preserva schema).
//  - Apaga secrets.json, sync-config.json e backups.
//  - Apaga logs.
//  - Responde com flag restart_required:true para o Electron reinicializar
//    (regenera secrets.json + bootstrap wizard).
//
// Uso esperado: tela Configuracoes "Apagar todos os dados deste salão".
// Reversível APENAS via backup local recente.
router.post('/me/delete-account-data', authMiddleware, [
  body('senha').notEmpty().withMessage('Senha é obrigatória para confirmar'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { senha } = req.body;
    // re-valida senha do user logado
    const user = await queryOne(
      `SELECT id, senha_hash FROM usuarios WHERE id = ? AND ativo = 1`,
      [req.user.userId]
    );
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }
    const valid = await bcrypt.compare(senha, user.senha_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Senha inválida' });
    }

    // Purga dados — DELETE em ordem de FK (filhos antes de pais).
    const tables = [
      'venda_itens',
      'vendas',
      'atendimentos',
      'agendamentos',
      'sync_log',
      'sync_conflicts',
      'clientes',
      'profissionais',
      'servicos',
      'produtos',
    ];
    for (const t of tables) {
      try {
        await queryRun(`DELETE FROM ${t}`, []);
      } catch (e) {
        console.warn(`[delete-account-data] Falha ao limpar ${t}: ${e.message}`);
      }
    }

    // Tenta remover arquivos persistidos. Best-effort — não bloqueia resposta.
    setTimeout(() => {
      try {
        const fs = require('fs');
        const path = require('path');
        const dataDir =
          process.env.SOFTHAIR_DATA_DIR ||
          path.join(__dirname, '..', '..', 'database');
        const filesToRemove = ['secrets.json', 'sync-config.json'];
        for (const f of filesToRemove) {
          try {
            const full = path.join(dataDir, f);
            if (fs.existsSync(full)) fs.unlinkSync(full);
          } catch (_) { /* skip */ }
        }
        // backups e logs
        for (const sub of ['backups', 'logs']) {
          const subPath = path.join(dataDir, sub);
          try {
            if (fs.existsSync(subPath)) {
              for (const entry of fs.readdirSync(subPath)) {
                try { fs.unlinkSync(path.join(subPath, entry)); } catch (_) { /* skip */ }
              }
            }
          } catch (_) { /* skip */ }
        }
        // Sai imediatamente para forçar regeneração do secret e fresh bootstrap.
        console.log('[delete-account-data] Dados purgados. Saindo para forçar restart...');
        process.exit(0);
      } catch (e) {
        console.error('[delete-account-data] Falha ao purgar arquivos:', e.message);
      }
    }, 1500);

    res.json({
      success: true,
      message: 'Todos os dados foram excluídos. O aplicativo será reiniciado.',
      data: { restart_required: true },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
