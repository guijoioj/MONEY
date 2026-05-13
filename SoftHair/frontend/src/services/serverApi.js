/**
 * @deprecated P2-A3: client legado para SOFT-HAIR-SERVER standalone.
 *
 * Pass 2: este client lia tokens do localStorage e aceitava URL sem validar
 * HTTPS — caminho paralelo ao `services/api.js`. Foi neutralizado por
 * segurança. Toda comunicação com servidor deve passar por `services/api.js`
 * (que usa `tokenStorage` in-memory e CSP + tenant validation).
 *
 * Mantido como módulo válido (no-op) para não quebrar imports residuais.
 */

class DeprecatedClient {
  constructor() {
    this._warned = false;
  }
  _warn(method) {
    if (this._warned) return;
    this._warned = true;
    console.warn(
      `[serverApi] DEPRECATED — use services/api.js. Método "${method}" ignorado.`
    );
  }
  setServerURL() { this._warn('setServerURL'); }
  setToken() { this._warn('setToken'); }
  clearToken() { this._warn('clearToken'); }
  async login() { this._warn('login'); throw new Error('serverApi deprecated'); }
  async register() { this._warn('register'); throw new Error('serverApi deprecated'); }
  async getProfile() { this._warn('getProfile'); throw new Error('serverApi deprecated'); }
  async changePassword() { this._warn('changePassword'); throw new Error('serverApi deprecated'); }
  async getClientes() { this._warn('getClientes'); return { success: false, error: 'deprecated' }; }
  async getCliente() { this._warn('getCliente'); return { success: false, error: 'deprecated' }; }
  async createCliente() { this._warn('createCliente'); return { success: false, error: 'deprecated' }; }
  async updateCliente() { this._warn('updateCliente'); return { success: false, error: 'deprecated' }; }
  async deleteCliente() { this._warn('deleteCliente'); return { success: false, error: 'deprecated' }; }
  async searchClientes() { this._warn('searchClientes'); return { success: false, error: 'deprecated' }; }
  async addCreditoCliente() { this._warn('addCreditoCliente'); return { success: false, error: 'deprecated' }; }
  async getProfissionais() { this._warn('getProfissionais'); return { success: false, error: 'deprecated' }; }
  async getProfissional() { this._warn('getProfissional'); return { success: false, error: 'deprecated' }; }
  async createProfissional() { this._warn('createProfissional'); return { success: false, error: 'deprecated' }; }
  async updateProfissional() { this._warn('updateProfissional'); return { success: false, error: 'deprecated' }; }
  async deleteProfissional() { this._warn('deleteProfissional'); return { success: false, error: 'deprecated' }; }
  async getServicos() { this._warn('getServicos'); return { success: false, error: 'deprecated' }; }
  async getServico() { this._warn('getServico'); return { success: false, error: 'deprecated' }; }
  async createServico() { this._warn('createServico'); return { success: false, error: 'deprecated' }; }
  async updateServico() { this._warn('updateServico'); return { success: false, error: 'deprecated' }; }
  async deleteServico() { this._warn('deleteServico'); return { success: false, error: 'deprecated' }; }
  async getProdutos() { this._warn('getProdutos'); return { success: false, error: 'deprecated' }; }
  async getProduto() { this._warn('getProduto'); return { success: false, error: 'deprecated' }; }
  async createProduto() { this._warn('createProduto'); return { success: false, error: 'deprecated' }; }
  async updateProduto() { this._warn('updateProduto'); return { success: false, error: 'deprecated' }; }
  async deleteProduto() { this._warn('deleteProduto'); return { success: false, error: 'deprecated' }; }
  async updateEstoque() { this._warn('updateEstoque'); return { success: false, error: 'deprecated' }; }
  async getAgendamentos() { this._warn('getAgendamentos'); return { success: false, error: 'deprecated' }; }
  async getAgendamento() { this._warn('getAgendamento'); return { success: false, error: 'deprecated' }; }
  async createAgendamento() { this._warn('createAgendamento'); return { success: false, error: 'deprecated' }; }
  async updateAgendamento() { this._warn('updateAgendamento'); return { success: false, error: 'deprecated' }; }
  async cancelarAgendamento() { this._warn('cancelarAgendamento'); return { success: false, error: 'deprecated' }; }
  async getVendas() { this._warn('getVendas'); return { success: false, error: 'deprecated' }; }
  async getVenda() { this._warn('getVenda'); return { success: false, error: 'deprecated' }; }
  async createVenda() { this._warn('createVenda'); return { success: false, error: 'deprecated' }; }
  async getChanges() { this._warn('getChanges'); return { success: false, error: 'deprecated' }; }
  async pushChanges() { this._warn('pushChanges'); return { success: false, error: 'deprecated' }; }
  async getLastSync() { this._warn('getLastSync'); return { success: false, error: 'deprecated' }; }
  async checkHealth() { this._warn('checkHealth'); throw new Error('serverApi deprecated'); }
  async checkConnectivity() { return false; }
}

export const apiClient = new DeprecatedClient();
export default DeprecatedClient;
