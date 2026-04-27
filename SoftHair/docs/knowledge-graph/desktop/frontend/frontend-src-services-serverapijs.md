# frontend/src/services/serverApi.js

**Repository:** Desktop
**File:** `frontend/src/services/serverApi.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `frontend/src/services/serverApi.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/servicos|servicos]]
- [[domains/produtos|produtos]]
- [[domains/vendas|vendas]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
/**
 * SoftHair API Client
 * Serviço para comunicação com SOFT-HAIR-SERVER
 */

import axios from 'axios';

class SoftHairApiClient {
  constructor() {
    this.baseURL = localStorage.getItem('softhair_server_url') || import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    this.token = localStorage.getItem('softhair_token');
    
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // Add interceptor for authentication
    this.api.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add interceptor for response handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, clear token and redirect to login
          this.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setServerURL(url) {
    this.baseURL = `${url}/api`;
    localStorage.setItem('softhair_server_url', url);
    this.api.defaults.baseURL = this.baseURL;
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('softhair_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('softhair_token');
  }

  // Auth endpoints
  async login(email, senha) {
    const response = await this.api.post('/auth/login', { email, senha });
    if (response.data.success && response.data.token) {
      this.setToken(response.data.token);
    }
    return response.data;
  }

  async register(data) {
    return (await this.api.post('/auth/register', data)).data;
  }

  async getProfile() {
    return (await this.api.get('/auth/profile')).data;
  }

  async changePassword(senhaAtual, novaSenha) {
    return (await this.api.post('/auth/change-password', { senhaAtual, novaSenha })).data;
  }

  // Clientes
  async getClientes(filtros = {}) {
    const params = new URLSearchParams();
    if (filtros.search) params.append('search', filtros.search);
    if (filtros.ativo !== undefined) params.append('ativo', filtros.ativo);
    if (filtros.page) params.append('page', filtros.page);
    if (filtros.limit) params.append('limit', filtros.limit);
    
    return (await this.api.get(`/clientes?${params.toString()}`)).data;
  }

  async getCliente(id) {
    return (await this.api.get(`/clientes/${id}`)).data;
  }

  async createCliente(data) {
    return (await this.api.post('/clientes', data)).data;
  }

  async updateCliente(id, data) {
    return (await this.api.put(`/clientes/${id}`, data)).data;
  }

  async deleteCliente(id) {
    return (await this.api.delete(`/clientes/${id}`)).data;
  }

  async searchClientes(termo) {
    return (await this.api.get(`/clientes/search/${encodeURIComponent(termo)}`)).data;
  }

  async addCreditoCliente(clienteId, valor) {
    return (await this.api.put(`/clientes/${clienteId}/credito`, { valor })).data;
  }

  // Profissionais
  async getProfissionais(filtros = {}) {
    return (await this.api.get('/profissionais', { params: filtros })).data;
  }

  async getProfissional(id) {
    return (await this.api.get(`/profissionais/${id}`)).data;
  }

  async createProfissional(data) {
    return (await this.api.post('/profissionais', data)).data;
  }

  async updateProfissional(id, data) {
    return (await this.api.put(`/profissionais/${id}`, data)).data;
  }

  async deleteProfissional(id) {
    return (await this.api.delete(`/profissionais/${id}`)).data;
  }

  // Serviços
  async getServicos(filtros = {}) {
    return (await this.api.get('/servicos', { params: filtros })).data;
  }

  async getServico(id) {
    return (await this.api.get(`/servicos/${id}`)).data;
  }

  async createServico(data) {
    return (await this.api.post('/servicos', data)).data;
  }

  async updateServico(id, data) {
    return (await this.api.put(`/servicos/${id}`, data)).data;
  }

  async deleteServico(id) {
    return (await this.api.delete(`/servicos/${id}`)).data;
  }

  // Produtos
  async getProdutos(filtros = {}) {
    return (await this.api.get('/produtos', { params: filtros })).data;
  }

  async getProduto(id) {
    return (await this.api.get(`/produtos/${id}`)).data;
  }

  async createProduto(data) {
    return (await this.api.post('/produtos', data)).data;
  }

  async updateProduto(id, data) {
    return (await this.api.put(`/produtos/${id}`, data)).data;
  }

  async deleteProduto(id) {
    return (await this.api.delete(`/produtos/${id}`)).data;
  }

  async updateEstoque(id, quantidade, tipo) {
    return (await this.api.put(`/produtos/${id}/estoque`, { quantidade, tipo })).data;
  }

  // Agendamentos
  async getAgendamentos(filtros = {}) {
    return (await this.api.get('/agendamentos', { params: filtros })).data;
  }

  async getAgendamento(id) {
    return (await this.api.get(`/agendamentos/${id}`)).data;
  }

  async createAgendamento(data) {
    return (await this.api.post('/agendamentos', data)).data;
  }

  async updateAgendamento(id, data) {
    return (await this.api.put(`/agendamentos/${id}`, data)).data;
  }

  async cancelarAgendamento(id, motivo) {
    return (await this.api.post(`/agendamentos/${id}/cancelar`, { motivo })).data;
  }

  // Vendas
  async getVendas(filtros = {}) {
    return (await this.api.get('/vendas', { params: filtros })).data;
  }

  async getVenda(id) {
    return (await this.api.get(`/vendas/${id}`)).data;
  }

  async createVenda(data) {
    return (await this.api.post('/vendas', data)).data;
  }

  // Sync
  async getChanges(since, tables = []) {
    return (await this.api.get('/sync/changes', {
      params: { since, tables: tables.join(',') }
    })).data;
  }

  async pushChanges(changes) {
    return (await this.api.post('/sync/push', { changes })).data;
  }

  async getLastSync() {
    return (await this.api.get('/sync/last-sync')).data;
  }

  // Health check
  async checkHealth() {
    const response = await axios.get(`${this.baseURL.replace('/api', '')}/health`, {
      timeout: 5000
    });
    return response.data;
  }

  // Exceptions
  async checkConnectivity() {
    try {
      await this.checkHealth();
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new SoftHairApiClient();

export default SoftHairApiClient;
```
