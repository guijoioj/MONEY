/**
 * Comissões V2 — client mobile.
 *
 * Consome /api/v2/comissoes/* (gestão completa) e /api/mobile/* (telas leves).
 */

import api from './api';

export type ComissaoStatus = 'pendente' | 'paga' | 'estornada' | 'cancelada' | 'bloqueada';

export interface Comissao {
  id: number;
  salao_id: number;
  profissional_id: number;
  profissional_nome?: string;
  cliente_id?: number | null;
  cliente_nome?: string;
  servico_id?: number | null;
  servico_nome?: string;
  produto_id?: number | null;
  produto_nome?: string;
  tipo_item?: 'servico' | 'produto' | 'pacote' | 'assinatura' | 'interno';
  papel_profissional: 'principal' | 'assistente' | 'vendedor' | 'indicador' | 'split';
  valor_base_cents: number;
  valor_comissao_cents: number;
  percentual?: number;
  valor_fixo_cents?: number;
  base_calculo?: string;
  status: ComissaoStatus;
  competencia?: string;
  data_geracao: string;
  data_pagamento?: string | null;
  origem: 'automatica' | 'manual' | 'ajuste' | 'migracao' | 'recalculo';
}

export interface Regra {
  id: number;
  salao_id: number;
  nome: string;
  descricao?: string;
  tipo: string;
  profissional_id?: number | null;
  servico_id?: number | null;
  produto_id?: number | null;
  categoria?: string;
  base_calculo: string;
  percentual?: number | null;
  valor_fixo_cents?: number | null;
  data_inicio: string;
  data_fim?: string | null;
  ativo: boolean;
  prioridade: number;
  condicoes_json?: any;
}

export interface ExtratoData {
  profissional: { id: number; nome: string };
  periodo: { competencia?: string; data_inicio?: string; data_fim?: string };
  total_pendente_cents: number;
  total_pago_cents: number;
  total_ajustes_pendentes_cents: number;
  liquido_a_pagar_cents: number;
  comissoes: Comissao[];
  ajustes: any[];
  pagamentos: any[];
}

// V2 — admin
export const comissoesV2 = {
  list: (params?: Record<string, any>) =>
    api.get('/api/v2/comissoes', { params }).then(r => r.data?.data as Comissao[] || []),

  dashboard: (params?: Record<string, any>) =>
    api.get('/api/v2/comissoes/dashboard', { params }).then(r => r.data?.data),

  extrato: (profissionalId: number, params?: Record<string, any>) =>
    api.get(`/api/v2/comissoes/profissional/${profissionalId}/extrato`, { params })
       .then(r => r.data?.data as ExtratoData),

  simulador: (body: Record<string, any>) =>
    api.post('/api/v2/comissoes/simulador', body).then(r => r.data?.data),

  pagar: (body: {
    profissional_id: number;
    data_inicio?: string;
    data_fim?: string;
    comissoes_ids?: number[];
    ajustes_ids?: number[];
    valor_confirmado_cents?: number;
    forma_pagamento?: string;
    observacao?: string;
    idempotency_key: string;
  }) => api.post('/api/v2/comissoes/pagar', body).then(r => r.data?.data),

  estornar: (body: { comissao_id?: number; venda_id?: number; motivo: string; valor_parcial_cents?: number }) =>
    api.post('/api/v2/comissoes/estornar', body).then(r => r.data?.data),
};

export const regras = {
  list: (params?: Record<string, any>) =>
    api.get('/api/v2/comissoes/regras', { params }).then(r => r.data?.data as Regra[] || []),

  get: (id: number) =>
    api.get(`/api/v2/comissoes/regras/${id}`).then(r => r.data?.data),

  create: (body: Partial<Regra>) =>
    api.post('/api/v2/comissoes/regras', body).then(r => r.data?.data),

  update: (id: number, body: Partial<Regra>) =>
    api.put(`/api/v2/comissoes/regras/${id}`, body).then(r => r.data?.data),

  remove: (id: number) =>
    api.delete(`/api/v2/comissoes/regras/${id}`).then(r => r.data?.data),

  clonar: (id: number) =>
    api.post(`/api/v2/comissoes/regras/${id}/clonar`).then(r => r.data?.data),
};

// Mobile lightweight endpoints
export const mobileComissoes = {
  resumo: (params?: { profissional_id?: number; competencia?: string }) =>
    api.get('/api/mobile/comissoes/resumo', { params }).then(r => r.data?.data),

  extrato: (params?: { profissional_id?: number; limit?: number; offset?: number }) =>
    api.get('/api/mobile/comissoes/extrato', { params }).then(r => r.data?.data as Comissao[] || []),
};

export const mobileApi = {
  me: () => api.get('/api/mobile/me').then(r => r.data?.data),
  dashboard: () => api.get('/api/mobile/dashboard').then(r => r.data?.data),
  agenda: (params?: { data?: string; profissional_id?: number }) =>
    api.get('/api/mobile/agenda', { params }).then(r => r.data?.data || []),
  notificacoes: (params?: { limit?: number }) =>
    api.get('/api/mobile/notificacoes', { params }).then(r => r.data?.data || []),
};

// Helpers
export const formatBRL = (cents?: number | null): string => {
  if (cents == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(cents) / 100);
};
