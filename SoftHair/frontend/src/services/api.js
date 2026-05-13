import axios from 'axios';

const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
// Dentro do Electron (file://) usa backend embarcado em 127.0.0.1:3001.
// Em dev (http://localhost:3000) também aponta para o backend embarcado por default.
const apiBaseURL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001/api';

const api = axios.create({
  baseURL: apiBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = isFileProtocol ? '/#/login' : '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
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
};

export const produtosAPI = {
  getAll: (params) => api.get('/produtos', { params }),
  getById: (id) => api.get(`/produtos/${id}`),
  create: (data) => api.post('/produtos', data),
  update: (id, data) => api.put(`/produtos/${id}`, data),
  delete: (id) => api.delete(`/produtos/${id}`),
};

export const agendamentosAPI = {
  getAll: (params) => api.get('/agendamentos', { params }),
  getPendentes: () => api.get('/agendamentos', { params: { status: 'pendente' } }),
  getDisponiveisProf: (profissionalId, params) => api.get(`/agendamentos/disponiveis/${profissionalId}`, { params }),
  getById: (id) => api.get(`/agendamentos/${id}`),
  create: (data) => api.post('/agendamentos', data),
  update: (id, data) => api.put(`/agendamentos/${id}`, data),
  delete: (id) => api.delete(`/agendamentos/${id}`),
};

export const vendasAPI = {
  getAll: (params) => api.get('/vendas', { params }),
  getById: (id) => api.get(`/vendas/${id}`),
  getByCliente: (clienteId) => api.get('/vendas', { params: { clienteId } }),
  create: (data) => api.post('/vendas', data),
  update: (id, data) => api.put(`/vendas/${id}`, data),
  delete: (id) => api.delete(`/vendas/${id}`),
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
  update: (id, data) => api.put(`/atendimentos/${id}`, data),
  delete: (id) => api.delete(`/atendimentos/${id}`),
};

export const fechamentosAPI = {
  getAll: (params) => api.get('/fechamentos', { params }),
  getEmAberto: (params) => api.get('/fechamentos', { params }),
  getById: (id) => api.get(`/fechamentos/${id}`),
  create: (data) => api.post('/fechamentos', data),
  delete: (id) => api.delete(`/fechamentos/${id}`),
};

export const creditosAPI = {
  getAll: (params) => api.get('/creditos', { params }),
  getByCliente: (clienteId) => api.get('/creditos', { params: { clienteId } }),
  getSaldo: (clienteId) => api.get('/creditos', { params: { clienteId } }),
  getTodosComSaldo: () => api.get('/creditos'),
  create: (data) => api.post('/creditos', data),
};

export const comissoesAPI = {
  getAll: (params) => api.get('/comissoes', { params }),
  getPagas: (params) => api.get('/comissoes', { params }),
  getEstornos: (params) => api.get('/comissoes', { params: { ...params, tipo: 'estorno' } }),
};

export const notificacoesAPI = {
  getAll: (params) => api.get('/notificacoes', { params }),
};

export const saloesAPI = {
  getMe: () => api.get('/saloes/me'),
  updateMe: (data) => api.put('/saloes/me', data),
};

export default api;
