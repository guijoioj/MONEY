const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { query } = require('../config/database');

router.post('/command', authMiddleware, async (req, res) => {
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

    // Resolver IDs reais para profissional e serviço
    if (parsed.action === 'create_agendamento' && parsed.data) {
      const d = parsed.data;
      if (d.professionalName) {
        const match = profsRes.find(p => p.nome.toLowerCase().includes(d.professionalName.toLowerCase()) || d.professionalName.toLowerCase().includes(p.nome.split(' ')[0].toLowerCase()));
        if (match) { d.professionalId = match.id; d.professionalName = match.nome; }
      }
      if (d.serviceName) {
        const match = servicosRes.find(s => s.nome.toLowerCase().includes(d.serviceName.toLowerCase()) || d.serviceName.toLowerCase().includes(s.nome.split(' ')[0].toLowerCase()));
        if (match) { d.serviceId = match.id; d.serviceName = match.nome; }
      }
    }

    res.json({ success: true, ...parsed });
  } catch (err) {
    console.error('[AI] Erro:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
