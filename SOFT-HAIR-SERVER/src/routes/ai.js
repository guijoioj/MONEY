const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../config/database');

// [A4] Rate limit específico — AI é caro e abre vetor de prompt injection
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Muitas requisições à IA. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Whitelist de actions que o LLM tem permissão de retornar
const ALLOWED_ACTIONS = new Set(['create_agendamento', 'navigate', 'unknown']);

function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0;
}

function isIsoDateTime(v) {
  if (typeof v !== 'string') return false;
  // YYYY-MM-DDTHH:MM(:SS)?
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v) && !isNaN(Date.parse(v));
}

router.post('/command', authMiddleware, aiLimiter, async (req, res) => {
  const { command, context = {} } = req.body;
  if (!command) return res.status(400).json({ success: false, error: 'Comando vazio' });

  const groqKey = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!groqKey && !anthropicKey) return res.status(503).json({ success: false, error: 'Configure GROQ_API_KEY ou ANTHROPIC_API_KEY no servidor' });

  try {
    // Função de chat unificada: Groq tem prioridade (grátis), fallback para Anthropic
    const chat = async (systemPrompt, userMsg) => {
      if (groqKey) {
        const Groq = require('groq-sdk');
        const groq = new Groq.default({ apiKey: groqKey });
        const r = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
          max_tokens: 512, temperature: 0.1,
        });
        return r.choices[0].message.content.trim();
      } else {
        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic.default({ apiKey: anthropicKey });
        const r = await client.messages.create({ model: 'claude-haiku-4-5', max_tokens: 512, system: systemPrompt, messages: [{ role: 'user', content: userMsg }] });
        return r.content[0].text.trim();
      }
    };
    const _unused = null; // placeholder

    // Buscar contexto do banco
    const salaoId = req.salaoId;
    const [profsRes, servicosRes] = await Promise.all([
      query('SELECT id, nome, especialidade FROM profissionais WHERE salao_id = $1 AND ativo = true ORDER BY nome', [salaoId]),
      query('SELECT id, nome, preco, duracao_minutos FROM servicos WHERE salao_id = $1 AND ativo = true ORDER BY nome LIMIT 50', [salaoId]),
    ]);

    const profissionais = profsRes.map(p => `${p.nome} (${p.especialidade || 'sem especialidade'})`).join(', ');
    const servicos = servicosRes.map(s => s.nome).join(', ');
    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

    const systemPrompt = `Você é um assistente para um salão de beleza. Interprete comandos em português e retorne JSON estruturado.

Hoje é: ${hoje}

Profissionais disponíveis: ${profissionais || 'nenhum cadastrado'}
Serviços disponíveis: ${servicos || 'nenhum cadastrado'}

Retorne APENAS JSON válido (sem markdown, sem explicação) com esta estrutura:
{
  "action": "create_agendamento" | "navigate" | "unknown",
  "confidence": 0.0-1.0,
  "data": {
    // para create_agendamento:
    "clienteName": "nome do cliente ou null",
    "professionalName": "nome do profissional mais próximo da lista ou null",
    "serviceName": "nome do serviço mais próximo da lista ou null",
    "dateTime": "YYYY-MM-DDTHH:MM ou null",
    "observacoes": "observações extras ou null"
  },
  "message": "Descrição legível do que será feito"
}

Para datas relativas: hoje=${new Date().toISOString().split('T')[0]}, amanhã=${new Date(Date.now()+86400000).toISOString().split('T')[0]}
`;

    const text = await chat(systemPrompt, command);
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { return res.status(422).json({ success: false, error: 'IA não retornou JSON válido', raw: text }); }

    // [A4] Validar estrutura: action whitelisted
    if (!parsed || typeof parsed !== 'object' || !ALLOWED_ACTIONS.has(parsed.action)) {
      console.warn('[AI][AUDIT] Resposta com action inválida:', { userId: req.user?.userId, salaoId, action: parsed?.action });
      return res.status(422).json({ success: false, error: 'IA retornou action não permitida' });
    }

    // Auditoria: log de TODA execução para análise posterior
    console.log('[AI][AUDIT]', JSON.stringify({
      timestamp: new Date().toISOString(),
      userId: req.user?.userId,
      salaoId,
      command: String(command).slice(0, 200),
      action: parsed.action,
      confidence: parsed.confidence,
    }));

    // Resolver IDs e EXECUTAR a ação diretamente
    if (parsed.action === 'create_agendamento' && parsed.data) {
      const d = parsed.data;

      // Resolver profissional
      if (d.professionalName) {
        const pn = d.professionalName.toLowerCase();
        const match = profsRes.find(p => p.nome.toLowerCase().includes(pn) || pn.includes(p.nome.split(' ')[0].toLowerCase()));
        if (match) { d.professionalId = match.id; d.professionalName = match.nome; }
      }

      // Resolver serviço
      if (d.serviceName) {
        const sn = d.serviceName.toLowerCase();
        const match = servicosRes.find(s => s.nome.toLowerCase().includes(sn) || sn.includes(s.nome.split(' ')[0].toLowerCase()));
        if (match) { d.serviceId = match.id; d.serviceName = match.nome; }
      }

      // Resolver cliente por nome (busca parcial)
      if (d.clienteName && !d.clienteId) {
        const cn = d.clienteName.toLowerCase();
        const clienteRows = await query(
          `SELECT id, nome FROM clientes WHERE salao_id = $1 AND ativo = true AND nome ILIKE $2 ORDER BY nome LIMIT 1`,
          [salaoId, `%${d.clienteName.split(' ')[0]}%`]
        );
        if (clienteRows.length > 0) { d.clienteId = clienteRows[0].id; d.clienteName = clienteRows[0].nome; }
      }

      // CRIAR AGENDAMENTO DIRETAMENTE se tiver tudo necessário
      if (d.clienteId && d.professionalId && d.dateTime) {
        // [A4] Validações fortes: IDs positivos, dateTime válido, IDs pertencem ao salão
        if (!isPositiveInt(Number(d.clienteId)) ||
            !isPositiveInt(Number(d.professionalId)) ||
            (d.serviceId && !isPositiveInt(Number(d.serviceId)))) {
          return res.status(422).json({ success: false, error: 'IDs retornados pela IA são inválidos' });
        }
        if (!isIsoDateTime(d.dateTime)) {
          return res.status(422).json({ success: false, error: 'dateTime retornado pela IA é inválido' });
        }

        // Garantir tenant-binding dos IDs
        const [cliOk, profOk, srvOk] = await Promise.all([
          query('SELECT 1 FROM clientes WHERE id = $1 AND salao_id = $2', [d.clienteId, salaoId]),
          query('SELECT 1 FROM profissionais WHERE id = $1 AND salao_id = $2', [d.professionalId, salaoId]),
          d.serviceId
            ? query('SELECT 1 FROM servicos WHERE id = $1 AND salao_id = $2', [d.serviceId, salaoId])
            : Promise.resolve([{}]),
        ]);
        if (!cliOk.length || !profOk.length || !srvOk.length) {
          console.warn('[AI][AUDIT] IDs fora do salão', { userId: req.user?.userId, salaoId, d });
          return res.status(403).json({ success: false, error: 'Recurso não pertence ao salão autenticado' });
        }

        const AgendamentoService = require('../services/AgendamentoService');
        const svc = new AgendamentoService();
        const result = await svc.criar({
          cliente_id: d.clienteId,
          profissional_id: d.professionalId,
          servico_id: d.serviceId || null,
          auxiliar_id: null,
          data_hora: d.dateTime,
          observacoes: typeof d.observacoes === 'string' ? d.observacoes.slice(0, 500) : null,
          status: 'agendado',
        }, salaoId);

        if (result.success) {
          return res.json({
            success: true,
            action: 'created',
            confidence: parsed.confidence,
            message: `✅ Agendamento criado: ${d.clienteName} com ${d.professionalName} em ${d.dateTime}`,
            data: { ...d, agendamentoId: result.data?.id },
          });
        } else {
          return res.status(400).json({ success: false, error: `IA falhou ao criar: ${result.error}`, data: d });
        }
      }

      // Falta algum dado — retorna para o frontend pré-preencher
      parsed.message = `Não consegui identificar ${!d.clienteId ? 'o cliente' : !d.professionalId ? 'o profissional' : 'a data'}. Abrindo formulário...`;
    }

    res.json({ success: true, ...parsed });
  } catch (err) {
    console.error('[AI] Erro:', err.message);
    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({ success: false, error: isProd ? 'Erro interno na IA' : err.message });
  }
});

module.exports = router;
