const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { sendPush } = require('../services/pushService');

const TIPOS_PONTO = ['entrada', 'saida', 'pausa', 'retorno_pausa', 'inicio_atendimento', 'fim_atendimento'];

// Helper: erro genérico em produção, detalhado em dev
function sendErr(res, code, message, error) {
  const isProd = process.env.NODE_ENV === 'production';
  res.status(code).json({
    success: false,
    error: isProd ? message : (error?.message || message)
  });
}

// GET /ponto
router.get('/ponto', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM registros_ponto WHERE profissional_id = $1 AND salao_id = $2 AND DATE(created_at) = CURRENT_DATE ORDER BY created_at`,
      [req.profissionalId, req.salaoId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar ponto:', error);
    sendErr(res, 500, 'Erro ao buscar ponto', error);
  }
});

// POST /ponto
router.post('/ponto', [
  body('tipo').isIn(TIPOS_PONTO).withMessage('Tipo inválido'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const result = await pool.query(
      `INSERT INTO registros_ponto (profissional_id, salao_id, tipo) VALUES ($1, $2, $3) RETURNING *`,
      [req.profissionalId, req.salaoId, req.body.tipo]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Erro ao registrar ponto:', error);
    sendErr(res, 500, 'Erro ao registrar ponto', error);
  }
});

// GET /agenda
router.get('/agenda', async (req, res) => {
  try {
    const data = req.query.data || new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone, s.nome as servico_nome
       FROM agendamentos a
       LEFT JOIN clientes c ON c.id = a.cliente_id
       LEFT JOIN servicos s ON s.id = a.servico_id
       WHERE a.profissional_id = $1 AND a.salao_id = $2 AND DATE(a.data_hora) = $3::date
       ORDER BY a.data_hora`,
      [req.profissionalId, req.salaoId, data]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar agenda:', error);
    sendErr(res, 500, 'Erro ao buscar agenda', error);
  }
});

// GET /atendimentos
router.get('/atendimentos', async (req, res) => {
  try {
    const data = req.query.data || new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `SELECT at.*, c.nome as cliente_nome, s.nome as servico_nome
       FROM atendimentos at
       LEFT JOIN clientes c ON c.id = at.cliente_id
       LEFT JOIN servicos s ON s.id = at.servico_id
       WHERE at.profissional_id = $1 AND at.salao_id = $2 AND DATE(at.created_at) = $3::date
       ORDER BY at.created_at DESC`,
      [req.profissionalId, req.salaoId, data]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar atendimentos:', error);
    sendErr(res, 500, 'Erro ao buscar atendimentos', error);
  }
});

// GET /comissoes
router.get('/comissoes', async (req, res) => {
  try {
    const hoje = new Date();
    const defaultInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
    const defaultFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);

    const data_inicio = req.query.data_inicio || defaultInicio;
    const data_fim = req.query.data_fim || defaultFim;

    const result = await pool.query(
      `SELECT * FROM comissoes
       WHERE profissional_id = $1 AND salao_id = $2 AND DATE(created_at) BETWEEN $3::date AND $4::date
       ORDER BY created_at DESC`,
      [req.profissionalId, req.salaoId, data_inicio, data_fim]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar comissões:', error);
    sendErr(res, 500, 'Erro ao buscar comissões', error);
  }
});

// POST /produtos-utilizados
router.post('/produtos-utilizados', [
  body('marca').notEmpty().withMessage('Marca é obrigatória'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { marca, coloracao, quantidade, cliente_id, cliente_nome, observacoes, agendamento_id, produto_id } = req.body;
    const qtd = quantidade || 1;

    // Validar que IDs referenciados pertencem ao salão do profissional (defesa cross-tenant)
    if (cliente_id) {
      const ok = await pool.query('SELECT 1 FROM clientes WHERE id = $1 AND salao_id = $2', [cliente_id, req.salaoId]);
      if (!ok.rows.length) return res.status(403).json({ success: false, error: 'cliente_id não pertence ao salão' });
    }
    if (agendamento_id) {
      const ok = await pool.query('SELECT 1 FROM agendamentos WHERE id = $1 AND salao_id = $2', [agendamento_id, req.salaoId]);
      if (!ok.rows.length) return res.status(403).json({ success: false, error: 'agendamento_id não pertence ao salão' });
    }
    if (produto_id) {
      const ok = await pool.query('SELECT 1 FROM produtos WHERE id = $1 AND salao_id = $2', [produto_id, req.salaoId]);
      if (!ok.rows.length) return res.status(403).json({ success: false, error: 'produto_id não pertence ao salão' });
    }

    // [P2-A4] Transação com UPDATE condicional para evitar overdraft de estoque.
    // O UPDATE só aplica se quantidade_estoque >= qtd; senão, rollback e 400.
    const client = await pool.connect();
    let inserted;
    try {
      await client.query('BEGIN');
      if (produto_id) {
        const upd = await client.query(
          `UPDATE produtos SET quantidade_estoque = quantidade_estoque - $1
           WHERE id = $2 AND salao_id = $3 AND quantidade_estoque >= $1
           RETURNING quantidade_estoque`,
          [qtd, produto_id, req.salaoId]
        );
        if (!upd.rows.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ success: false, error: 'Estoque insuficiente' });
        }
      }
      inserted = await client.query(
        `INSERT INTO produtos_utilizados (profissional_id, salao_id, cliente_id, cliente_nome, marca, coloracao, quantidade, observacoes, agendamento_id, produto_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [req.profissionalId, req.salaoId, cliente_id || null, cliente_nome || null, marca, coloracao || null, qtd, observacoes || null, agendamento_id || null, produto_id || null]
      );
      await client.query('COMMIT');
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch {}
      throw txErr;
    } finally {
      client.release();
    }

    res.status(201).json({ success: true, data: inserted.rows[0] });
  } catch (error) {
    console.error('Erro ao registrar produto utilizado:', error);
    sendErr(res, 500, 'Erro ao registrar produto utilizado', error);
  }
});

// GET /produtos-utilizados
router.get('/produtos-utilizados', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM produtos_utilizados WHERE profissional_id = $1 AND salao_id = $2 ORDER BY created_at DESC LIMIT 100`,
      [req.profissionalId, req.salaoId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao listar produtos utilizados:', error);
    sendErr(res, 500, 'Erro ao listar produtos utilizados', error);
  }
});

// GET /atendimentos-hoje
router.get('/atendimentos-hoje', async (req, res) => {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const result = await pool.query(`
      SELECT a.*, c.nome as cliente_nome, c.telefone as cliente_telefone, s.nome as servico_nome
      FROM agendamentos a
      LEFT JOIN clientes c ON c.id = a.cliente_id
      LEFT JOIN servicos s ON s.id = a.servico_id
      WHERE a.profissional_id = $1 AND a.salao_id = $2 AND DATE(a.data_hora) = $3::date
        AND a.status IN ('agendado', 'confirmado', 'em_andamento')
      ORDER BY a.data_hora
    `, [req.profissionalId, req.salaoId, hoje]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erro ao buscar atendimentos de hoje:', error);
    sendErr(res, 500, 'Erro ao buscar atendimentos de hoje', error);
  }
});

// POST /atendimentos/:id/iniciar
router.post('/atendimentos/:id/iniciar', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE agendamentos SET status = 'em_andamento', updated_at = NOW()
       WHERE id = $1 AND profissional_id = $2 AND salao_id = $3
       RETURNING *, (SELECT nome FROM clientes WHERE id = agendamentos.cliente_id) as cliente_nome`,
      [req.params.id, req.profissionalId, req.salaoId]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, error: 'Atendimento não encontrado' });

    await pool.query(
      `INSERT INTO registros_ponto (profissional_id, salao_id, tipo) VALUES ($1, $2, 'inicio_atendimento')`,
      [req.profissionalId, req.salaoId]
    );
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Erro ao iniciar atendimento:', error);
    sendErr(res, 500, 'Erro ao iniciar atendimento', error);
  }
});

// GET /perfil
router.get('/perfil', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nome, email, telefone, especialidade, comissao, ativo
       FROM profissionais WHERE id = $1 AND salao_id = $2`,
      [req.profissionalId, req.salaoId]
    );
    if (!result.rows.length)
      return res.status(404).json({ success: false, error: 'Profissional não encontrado' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Erro ao buscar perfil do profissional:', error);
    sendErr(res, 500, 'Erro ao buscar perfil', error);
  }
});

// POST /aviso-atraso
router.post('/aviso-atraso', [
  body('agendamento_id').notEmpty().withMessage('agendamento_id é obrigatório'),
  body('minutos').isInt({ min: 1 }).withMessage('minutos deve ser inteiro positivo'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { agendamento_id, minutos, mensagem } = req.body;

    const agend = await pool.query(
      'SELECT * FROM agendamentos WHERE id = $1 AND profissional_id = $2 AND salao_id = $3',
      [agendamento_id, req.profissionalId, req.salaoId]
    );
    if (!agend.rows.length)
      return res.status(404).json({ success: false, error: 'Agendamento não encontrado' });

    // Registrar notificação de atraso para o cliente
    const ag = agend.rows[0];
    const textoNotif = mensagem || `Seu profissional chegará com aproximadamente ${minutos} minutos de atraso.`;

    await pool.query(
      `INSERT INTO notificacoes (salao_id, cliente_id, tipo, titulo, mensagem, lida)
       VALUES ($1, $2, 'aviso_atraso', 'Aviso de Atraso', $3, false)`,
      [req.salaoId, ag.cliente_id, textoNotif]
    );

    // Enviar push para o cliente do agendamento (validar tenant)
    if (ag.cliente_id) {
      const clienteRow = await pool.query(
        'SELECT push_token FROM clientes WHERE id = $1 AND salao_id = $2 AND push_token IS NOT NULL LIMIT 1',
        [ag.cliente_id, req.salaoId]
      );
      if (clienteRow.rows[0]?.push_token) {
        await sendPush(
          clienteRow.rows[0].push_token,
          'Aviso de atraso ⏰',
          textoNotif,
          { screen: 'pedidos' }
        );
      }
    }

    res.json({ success: true, data: { agendamento_id, minutos, mensagem: textoNotif } });
  } catch (error) {
    console.error('Erro ao enviar aviso de atraso:', error);
    sendErr(res, 500, 'Erro ao enviar aviso de atraso', error);
  }
});

// POST /atendimentos/:id/finalizar
router.post('/atendimentos/:id/finalizar', async (req, res) => {
  try {
    const agend = await pool.query(
      'SELECT * FROM agendamentos WHERE id = $1 AND profissional_id = $2 AND salao_id = $3',
      [req.params.id, req.profissionalId, req.salaoId]
    );
    if (!agend.rows.length)
      return res.status(404).json({ success: false, error: 'Atendimento não encontrado' });

    const ag = agend.rows[0];

    let atend = await pool.query(
      `SELECT * FROM atendimentos WHERE agendamento_id = $1 AND profissional_id = $2 AND salao_id = $3`,
      [ag.id, req.profissionalId, req.salaoId]
    );

    if (atend.rows.length) {
      atend = await pool.query(`
        UPDATE atendimentos
        SET status = 'finalizado', observacoes = COALESCE($3, observacoes), updated_at = NOW()
        WHERE agendamento_id = $1 AND profissional_id = $2 AND salao_id = $4
        RETURNING *
      `, [ag.id, req.profissionalId, req.body.observacoes || null, req.salaoId]);
    } else {
      atend = await pool.query(`
        INSERT INTO atendimentos (agendamento_id, cliente_id, profissional_id, salao_id, servico_id, data_atendimento, status, observacoes, valor)
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'finalizado', $6, $7)
        RETURNING *
      `, [ag.id, ag.cliente_id, req.profissionalId, req.salaoId, ag.servico_id, req.body.observacoes || null, ag.valor || null]);
    }

    await pool.query(
      `UPDATE agendamentos SET status = 'finalizado', updated_at = NOW() WHERE id = $1 AND salao_id = $2`,
      [req.params.id, req.salaoId]
    );

    await pool.query(
      `INSERT INTO registros_ponto (profissional_id, salao_id, tipo) VALUES ($1, $2, 'fim_atendimento')`,
      [req.profissionalId, req.salaoId]
    );

    res.json({ success: true, data: atend.rows[0] });
  } catch (error) {
    console.error('Erro ao finalizar atendimento:', error);
    sendErr(res, 500, 'Erro ao finalizar atendimento', error);
  }
});

// GET /chat — histórico de mensagens do profissional
router.get('/chat', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM chat_mensagens
       WHERE salao_id = $1
         AND (remetente_id = $2 OR destinatario_id = $2)
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.salaoId, req.profissionalId]
    );
    res.json({ success: true, data: result.rows.reverse() });
  } catch (error) {
    console.error('Erro ao buscar chat:', error);
    sendErr(res, 500, 'Erro ao buscar chat', error);
  }
});

module.exports = router;
