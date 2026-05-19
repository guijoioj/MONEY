/**
 * RuleResolver — resolve qual regra aplica ao contexto.
 *
 * Hierarquia (prioridade decrescente):
 *   1. profissional_servico, profissional_produto
 *   2. servico, produto
 *   3. categoria_servico, categoria_produto
 *   4. profissional
 *   5. meta
 *   6. dia_semana
 *   7. horario
 *   8. global
 *
 * Filtra por vigência, condicoes_json (dia_semana, forma_pagamento, valor_minimo),
 * salao_id, ativo=true.
 *
 * @module services/CommissionEngine/RuleResolver
 */

const PRIORIDADE_TIPO = {
  profissional_servico:  100,
  profissional_produto:  100,
  servico:                80,
  produto:                80,
  categoria_servico:      70,
  categoria_produto:      70,
  profissional:           60,
  meta:                   50,
  dia_semana:             40,
  horario:                30,
  global:                 10,
  assistente:             50, // alvo específico, mesmo nível de meta
};

/**
 * @param {object} ctx
 * @param {number} ctx.salaoId
 * @param {number} ctx.profissionalId
 * @param {'principal'|'assistente'|'vendedor'|'indicador'|'split'} ctx.papel
 * @param {number|null} ctx.servicoId
 * @param {number|null} ctx.produtoId
 * @param {string|null} ctx.categoria
 * @param {'servico'|'produto'|'pacote'|'assinatura'|'interno'} ctx.tipoItem
 * @param {number} ctx.valorBrutoCents
 * @param {Date|string} ctx.dataAtendimento
 * @param {string} ctx.formaPagamento
 * @param {Array<object>} regras  - pre-fetched de regras_comissao
 * @returns {object|null} regra escolhida ou null se nenhuma aplicável
 */
function resolve(ctx, regras) {
  if (!Array.isArray(regras) || regras.length === 0) return null;

  const aplicaveis = regras.filter(r => isApplicable(r, ctx));
  if (aplicaveis.length === 0) return null;

  aplicaveis.sort((a, b) => {
    // 1. prioridade manual (campo) — permite override explícito da hierarquia
    const ma = a.prioridade ?? 0;
    const mb = b.prioridade ?? 0;
    if (ma !== mb) return mb - ma;

    // 2. Tipo (prioridade hierárquica padrão)
    const pa = PRIORIDADE_TIPO[a.tipo] || 0;
    const pb = PRIORIDADE_TIPO[b.tipo] || 0;
    if (pa !== pb) return pb - pa;

    // 3. data_inicio mais recente
    const da = new Date(a.data_inicio).getTime();
    const db_ = new Date(b.data_inicio).getTime();
    return db_ - da;
  });

  return aplicaveis[0];
}

/**
 * Testa se uma regra aplica ao contexto.
 * @param {object} regra
 * @param {object} ctx
 * @returns {boolean}
 */
function isApplicable(regra, ctx) {
  // 0. Ativo + multi-tenant
  if (regra.ativo === false) return false;
  if (regra.salao_id !== ctx.salaoId) return false;

  // 1. Vigência
  const data = toDate(ctx.dataAtendimento);
  if (regra.data_inicio && toDate(regra.data_inicio) > data) return false;
  if (regra.data_fim && toDate(regra.data_fim) < data) return false;

  // 2. Alvo conforme tipo
  switch (regra.tipo) {
    case 'global':
      // aplica a tudo do salão
      break;
    case 'profissional':
      if (regra.profissional_id !== ctx.profissionalId) return false;
      break;
    case 'servico':
      if (regra.servico_id !== ctx.servicoId) return false;
      break;
    case 'produto':
      if (regra.produto_id !== ctx.produtoId) return false;
      break;
    case 'categoria_servico':
      if (ctx.tipoItem !== 'servico') return false;
      if (regra.categoria !== ctx.categoria) return false;
      break;
    case 'categoria_produto':
      if (ctx.tipoItem !== 'produto') return false;
      if (regra.categoria !== ctx.categoria) return false;
      break;
    case 'profissional_servico':
      if (regra.profissional_id !== ctx.profissionalId) return false;
      if (regra.servico_id !== ctx.servicoId) return false;
      break;
    case 'profissional_produto':
      if (regra.profissional_id !== ctx.profissionalId) return false;
      if (regra.produto_id !== ctx.produtoId) return false;
      break;
    case 'assistente':
      if (ctx.papel !== 'assistente') return false;
      if (regra.profissional_id != null && regra.profissional_id !== ctx.profissionalId) return false;
      break;
    case 'meta':
      // metas são tratadas em fase separada (MetaCalculator)
      // aqui retornamos false pra não competirem com regras de comissão direta
      return false;
    case 'dia_semana':
      // ver condicoes_json
      break;
    case 'horario':
      // ver condicoes_json
      break;
    default:
      return false;
  }

  // 3. Condições JSON
  const cond = regra.condicoes_json || {};

  // Aplicar a papel quando regra não é especificamente de papel
  // Regras 'global', 'servico' etc valem por padrão pro principal só.
  // Se condicoes_json.papeis existir, restringe.
  if (Array.isArray(cond.papeis) && cond.papeis.length > 0) {
    if (!cond.papeis.includes(ctx.papel)) return false;
  } else if (regra.tipo !== 'assistente' && ctx.papel === 'assistente') {
    // regras não-assistente não aplicam a papel assistente
    return false;
  }

  if (Array.isArray(cond.dias_semana) && cond.dias_semana.length > 0) {
    const dia = data.getDay(); // 0=domingo, 6=sábado
    if (!cond.dias_semana.includes(dia)) return false;
  }

  if (cond.hora_inicio || cond.hora_fim) {
    const hora = data.getHours() * 60 + data.getMinutes();
    if (cond.hora_inicio) {
      const [h, m] = cond.hora_inicio.split(':').map(Number);
      if (hora < h * 60 + m) return false;
    }
    if (cond.hora_fim) {
      const [h, m] = cond.hora_fim.split(':').map(Number);
      if (hora > h * 60 + m) return false;
    }
  }

  if (Array.isArray(cond.formas_pagamento) && cond.formas_pagamento.length > 0) {
    if (!cond.formas_pagamento.includes(ctx.formaPagamento)) return false;
  }

  if (cond.valor_minimo_cents != null) {
    if (ctx.valorBrutoCents < cond.valor_minimo_cents) return false;
  }

  if (cond.valor_maximo_cents != null) {
    if (ctx.valorBrutoCents > cond.valor_maximo_cents) return false;
  }

  if (Array.isArray(cond.tipos_item) && cond.tipos_item.length > 0) {
    if (!cond.tipos_item.includes(ctx.tipoItem)) return false;
  }

  return true;
}

function toDate(v) {
  if (v instanceof Date) return v;
  return new Date(v);
}

module.exports = { resolve, isApplicable, PRIORIDADE_TIPO };
