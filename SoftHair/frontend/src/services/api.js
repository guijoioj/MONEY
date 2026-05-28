import axios from 'axios';

const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

// Default fallback. Real URL vem do serverConfig do Electron (ver loadServerConfigURL abaixo).
const apiBaseURL = import.meta.env.VITE_API_URL
  || (isFileProtocol ? 'http://127.0.0.1:3001/api' : 'http://127.0.0.1:3001/api');

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// No Electron, lê config persistida ANTES das requests começarem.
// IPC bridge expõe window.electron.serverConfig.get().
// Exporta baseURL ativa em window pra hooks (ex: useWebSocket) descobrirem o host real.
if (typeof window !== 'undefined') window.__SH_API_BASE__ = apiBaseURL;
if (typeof window !== 'undefined' && window.electron?.serverConfig?.get) {
  window.electron.serverConfig.get().then((cfg) => {
    if (cfg?.url) {
      const baseUrl = cfg.url.endsWith('/api') ? cfg.url : `${cfg.url}/api`;
      api.defaults.baseURL = baseUrl;
      window.__SH_API_BASE__ = baseUrl;
      console.log('[api] baseURL ajustada pra:', baseUrl);
    }
  }).catch(() => { /* mantém fallback */ });
}

// Token key unificado — usado por api.js, syncManager e todo o app
export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.href = isFileProtocol ? '/#/login' : '/login';
    }
    // V2: 503 com error='comissoes_offline_indisponivel' → dispatch evento
    // pra Layout exibir banner. Backend Electron emite isso quando offline.
    if (
      error.response?.status === 503 &&
      error.response?.data?.error === 'comissoes_offline_indisponivel' &&
      typeof window !== 'undefined' &&
      typeof window.dispatchEvent === 'function'
    ) {
      try {
        window.dispatchEvent(new CustomEvent('softhair:comissoes-offline', {
          detail: { message: error.response?.data?.message, timestamp: Date.now() },
        }));
      } catch (_) { /* noop */ }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  changePassword: (data) => api.post('/auth/change-password', data),
  me: () => api.get('/auth/me'),
};

export const clientesAPI = {
  getAll: (params) => api.get('/clientes', { params }),
  getById: (id) => api.get(`/clientes/${id}`),
  create: (data) => api.post('/clientes', data),
  update: (id, data) => api.put(`/clientes/${id}`, data),
  delete: (id) => api.delete(`/clientes/${id}`),
  // Perfil consolidado: favoritos + resumo + últimas atividades
  getPerfil: (id) => api.get(`/clientes/${id}/perfil`),
};

export const servicosAPI = {
  getAll: (params) => api.get('/servicos', { params }),
  getById: (id) => api.get(`/servicos/${id}`),
  create: (data) => api.post('/servicos', data),
  update: (id, data) => api.put(`/servicos/${id}`, data),
  delete: (id) => api.delete(`/servicos/${id}`),
  getCategorias: () => api.get('/servicos/categorias'),
};

export const produtosAPI = {
  getAll: (params) => api.get('/produtos', { params }),
  getById: (id) => api.get(`/produtos/${id}`),
  create: (data) => api.post('/produtos', data),
  update: (id, data) => api.put(`/produtos/${id}`, data),
  delete: (id) => api.delete(`/produtos/${id}`),
  // Define estoque absoluto (admin) ou aplica delta (recepção pode -100..+100 com motivo).
  updateEstoque: (id, quantidade) => api.patch(`/produtos/${id}/estoque`, { absoluto: quantidade }),
  ajustarEstoque: (id, delta, motivo) => api.patch(`/produtos/${id}/estoque`, { delta, motivo }),
  getCategorias: () => api.get('/produtos/categorias'),
  getEstoqueBaixo: () => api.get('/produtos/estoque-baixo'),
};

export const agendamentosAPI = {
  getAll: (params) => api.get('/agendamentos', { params }),
  getProximos: (dias) => api.get('/agendamentos/proximos', { params: { dias } }),
  getPendentes: () => api.get('/agendamentos/pendentes'),
  getById: (id) => api.get(`/agendamentos/${id}`),
  create: (data) => api.post('/agendamentos', data),
  update: (id, data) => api.put(`/agendamentos/${id}`, data),
  delete: (id) => api.delete(`/agendamentos/${id}`),
  converter: (id) => api.post(`/agendamentos/converter/${id}`),
  converterTodos: () => api.post('/agendamentos/converter-todos'),
};

export const vendasAPI = {
  getAll: (params) => api.get('/vendas', { params }),
  getById: (id) => api.get(`/vendas/${id}`),
  getByCliente: (clienteId) => api.get('/vendas', { params: { clienteId } }),
  create: (data) => api.post('/vendas', data),
  update: (id, data) => api.put(`/vendas/${id}`, data),
  delete: (id) => api.delete(`/vendas/${id}`),
  getEstatisticas: (params) => api.get('/vendas/estatisticas', { params }),
};

export const usuariosAPI = {
  getAll: () => api.get('/usuarios'),
  getById: (id) => api.get(`/usuarios/${id}`),
  create: (data) => api.post('/usuarios', data),
  update: (id, data) => api.put(`/usuarios/${id}`, data),
  updateSenha: (id, senha) => api.put(`/usuarios/${id}/senha`, { senha }),
  delete: (id) => api.delete(`/usuarios/${id}`),
};

export const profissionaisAPI = {
  getAll: (params) => api.get('/profissionais', { params }),
  getById: (id) => api.get(`/profissionais/${id}`),
  create: (data) => api.post('/profissionais', data),
  update: (id, data) => api.put(`/profissionais/${id}`, data),
  delete: (id) => api.delete(`/profissionais/${id}`),
  // Painel interno: comissões + vendas + atendimentos + top clientes/serviços/produtos
  getPainel: (id, params) => api.get(`/profissionais/${id}/painel`, { params }),
  // Favoritos de um cliente específico
  getClienteFavoritos: (profId, clienteId) =>
    api.get(`/profissionais/${profId}/painel/clientes/${clienteId}/favoritos`),
};

export const atendimentosAPI = {
  getAll: (params) => api.get('/atendimentos', { params }),
  getById: (id) => api.get(`/atendimentos/${id}`),
  create: (data) => api.post('/atendimentos', data),
  update: (id, data) => {
    console.log('API update - id:', id, 'data:', data);
    return api.put(`/atendimentos/${id}`, data).then(response => {
      console.log('API update - response:', response);
      return response;
    });
  },
  delete: (id) => api.delete(`/atendimentos/${id}`),
  fechamento: (data) => api.post('/atendimentos/fechamento', data),
  // Fluxo atendimento aberto: gerenciar serviços do atendimento.
  listarServicos: (id) => api.get(`/atendimentos/${id}/servicos`),
  adicionarServico: (id, data) => api.post(`/atendimentos/${id}/servicos`, data),
  removerServico: (id, itemId) => api.delete(`/atendimentos/${id}/servicos/${itemId}`),
  // Produtos usados no atendimento.
  listarProdutos: (id) => api.get(`/atendimentos/${id}/produtos`),
  adicionarProduto: (id, data) => api.post(`/atendimentos/${id}/produtos`, data),
  removerProduto: (id, itemId) => api.delete(`/atendimentos/${id}/produtos/${itemId}`),
};

export const fechamentosAPI = {
  getAll: (params) => api.get('/fechamentos', { params }),
  getEmAberto: (params) => api.get('/fechamentos/em-aberto', { params }),
  getById: (id) => api.get(`/fechamentos/${id}`),
  create: (data) => api.post('/fechamentos', data),
  delete: (id) => api.delete(`/fechamentos/${id}`),
};

export const historicoAPI = {
  getResumo: (clienteId) => api.get(`/historico/cliente/${clienteId}/resumo`),
  getByCliente: (clienteId, params) => api.get(`/historico/cliente/${clienteId}/historico`, { params }),
};

export const creditosAPI = {
  getAll: (params) => api.get('/creditos', { params }),
  getByCliente: (clienteId) => api.get(`/creditos/cliente/${clienteId}`),
  getSaldo: (clienteId) => api.get(`/creditos/saldo/${clienteId}`),
  getTodosComSaldo: () => api.get('/creditos/todos-com-saldo'),
  create: (data) => api.post('/creditos', data),
  delete: (id) => api.delete(`/creditos/${id}`),
};

export const comissoesAPI = {
  getPagas: (params) => api.get('/comissoes/pagas', { params }),
  getEstornos: (params) => api.get('/comissoes/estornos', { params }),
  pagar: (data) => api.post('/comissoes/pagar', data),
  estornar: (data) => api.post('/comissoes/estornar', data),
};

export const backupHistoryAPI = {
  list: () => api.get('/backup/historico'),
  create: () => api.post('/backup/historico'),
  download: (id) => api.get(`/backup/historico/${id}/download`, { responseType: 'blob' }),
  remove: (id) => api.delete(`/backup/historico/${id}`),
};

export const auditLogAPI = {
  list: (params) => api.get('/audit-log', { params }),
  actions: () => api.get('/audit-log/actions'),
};

export const relatoriosAPI = {
  faturamento: (periodo = 'mes') => api.get('/relatorios/faturamento', { params: { periodo } }),
  faturamentoDiario: (dias = 30) => api.get('/relatorios/faturamento-diario', { params: { dias } }),
  rankingProfissionais: (dias = 30) => api.get('/relatorios/ranking-profissionais', { params: { dias } }),
  topClientes: (dias = 90) => api.get('/relatorios/top-clientes', { params: { dias } }),
  produtosVendidos: (dias = 30) => api.get('/relatorios/produtos-vendidos', { params: { dias } }),
  comissoesPagar: () => api.get('/relatorios/comissoes-pagar'),
  servicosMaisVendidos: (dias = 30) => api.get('/relatorios/servicos-mais-vendidos', { params: { dias } }),
};

export const pedidosAgendamentoAPI = {
  getSalao: (params) => api.get('/app/pedidos/salao', { params }),
  verificarDisponibilidade: (id) => api.get(`/app/pedidos/${id}/verificar-disponibilidade`),
  proximoHorario: (id) => api.get(`/app/pedidos/${id}/proximo-horario`),
  aprovar: (id, data) => api.put(`/app/pedidos/${id}/aprovar`, data),
  rejeitar: (id, data) => api.put(`/app/pedidos/${id}/rejeitar`, data),
  getProfissionaisDisponibilidade: (salonId, params) => api.get(`/app/pedidos/saloes/${salonId}/profissionais`, { params }),
};

export const notificacoesAPI = {
  getAll: (params) => api.get('/notificacoes', { params }),
  getCount: () => api.get('/notificacoes/count'),
  marcarLida: (id) => api.put(`/notificacoes/${id}/lida`),
  marcarTodasLidas: () => api.put('/notificacoes/marcar-todas-lidas'),
  delete: (id) => api.delete(`/notificacoes/${id}`),
  limparLidas: () => api.delete('/notificacoes/limpar-lidas'),
  gerarInativos: () => api.post('/notificacoes/gerar-inativos'),
};

export const backupAPI = {
  create: () => api.post('/backup/create'),
  getLocal: () => api.get('/backup/local'),
  restore: (filename) => api.post(`/backup/restore/${filename}`),
  getCloudStatus: () => api.get('/backup/google/status'),
  getAuthUrl: () => api.get('/backup/google/auth-url'),
  googleCallback: (code) => api.post('/backup/google/callback', { code }),
  syncToCloud: (filename) => api.post(`/backup/google/sync/${filename}`),
  getCloudFiles: () => api.get('/backup/google/files'),
  getCloudBackups: () => api.get('/backup/cloud'),
  getGoogleConfig: () => api.get('/backup/google/config'),
  saveGoogleConfig: (config) => api.post('/backup/google/config', config),
  disconnectGoogle: () => api.get('/backup/google/disconnect'),
};

export const saloesAPI = {
  getMe: () => api.get('/saloes/me'),
  updateMe: (data) => api.put('/saloes/me', data),
};

export const bloqueiosAPI = {
  getByData: (data, profissionalId) => api.get('/bloqueios', { params: { data, profissionalId } }),
  create: (data) => api.post('/bloqueios', data),
  delete: (id) => api.delete(`/bloqueios/${id}`),
};

export const configuracoesAPI = {
  getAll: () => api.get('/configuracoes'),
  set: (chave, valor) => api.put('/configuracoes', { chave, valor }),
};

export const despesasAPI = {
  getAll: (params) => api.get('/despesas', { params }),
  getResumo: (params) => api.get('/despesas/resumo', { params }),
  create: (data) => api.post('/despesas', data),
  update: (id, data) => api.put(`/despesas/${id}`, data),
  remove: (id) => api.delete(`/despesas/${id}`),
};

export const financeiroAPI = {
  getDre: (params) => api.get('/financeiro/dre', { params }),
  getProjecao: () => api.get('/financeiro/projecao'),
};

// ─── COMISSÕES V2 ───────────────────────────────────────────
// Endpoints novos paralelos a v1. Server: /api/v2/comissoes/*
// Electron offline retorna 503 — frontend mostra banner.
export const comissoesV2API = {
  list: (params) => api.get('/v2/comissoes', { params }),
  dashboard: (params) => api.get('/v2/comissoes/dashboard', { params }),
  extrato: (profissionalId, params) =>
    api.get(`/v2/comissoes/profissional/${profissionalId}/extrato`, { params }),
  simulador: (data) => api.post('/v2/comissoes/simulador', data),
  pagar: (data) => api.post('/v2/comissoes/pagar', data),
  estornar: (data) => api.post('/v2/comissoes/estornar', data),
};

export const regrasComissaoAPI = {
  list: (params) => api.get('/v2/comissoes/regras', { params }),
  getById: (id) => api.get(`/v2/comissoes/regras/${id}`),
  create: (data) => api.post('/v2/comissoes/regras', data),
  update: (id, data) => api.put(`/v2/comissoes/regras/${id}`, data),
  delete: (id) => api.delete(`/v2/comissoes/regras/${id}`),
  clonar: (id) => api.post(`/v2/comissoes/regras/${id}/clonar`),
};

export const ajustesComissaoAPI = {
  list: (params) => api.get('/v2/comissoes/ajustes', { params }),
  create: (data) => api.post('/v2/comissoes/ajustes', data),
  cancelar: (id) => api.put(`/v2/comissoes/ajustes/${id}/cancelar`),
};

export default api;
