import axios from 'axios';
import tokenStorage from './tokenStorage';

const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
// Dentro do Electron (file://) usa backend embarcado em 127.0.0.1:3001.
// Em dev sem VITE_API_URL definida, aponta pro backend embarcado.
const apiBaseURL = import.meta.env.VITE_API_URL || (isFileProtocol ? 'http://127.0.0.1:3001/api' : 'http://127.0.0.1:3001/api');

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token key unificado — usado por api.js, syncManager e todo o app
export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';

// E19: prioriza tokenStorage in-memory; localStorage fica como fallback de
// compatibilidade até que todos os pontos do app sejam migrados. Em XSS o
// tokenStorage in-memory limita a exposição: o atacante teria que executar
// JS dentro do contexto do app vivo, não basta ler o disco.
function readToken() {
  return tokenStorage.getToken() || (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
}

function clearTokens() {
  tokenStorage.clearTokens();
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// P5-C3 + P5-M5: interceptor detecta stub:true e emite CustomEvent global.
// Componente <StubGlobalBanner> escuta e renderiza aviso "em desenvolvimento".
// Mantém telas existentes intocadas — adição é puramente aditiva.
api.interceptors.response.use(
  (response) => {
    try {
      const data = response?.data;
      if (data && typeof data === 'object' && data.stub === true) {
        const url = response?.config?.url || '';
        const message = data.message || null;
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('softhair:stub-response', {
            detail: { url, message, timestamp: Date.now() },
          }));
        }
      }
    } catch (_) { /* never break the response on telemetry */ }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      clearTokens();
      window.location.href = isFileProtocol ? '/#/login' : '/login';
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
  updateEstoque: (id, quantidade) => api.patch(`/produtos/${id}/estoque`, { quantidade }),
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

export const profissionaisAPI = {
  getAll: (params) => api.get('/profissionais', { params }),
  getById: (id) => api.get(`/profissionais/${id}`),
  create: (data) => api.post('/profissionais', data),
  update: (id, data) => api.put(`/profissionais/${id}`, data),
  delete: (id) => api.delete(`/profissionais/${id}`),
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

export default api;
