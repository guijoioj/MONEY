/**
 * @deprecated P2-A3: SyncManager legado offline-first.
 *
 * Pass 2: usava `localStorage.getItem('softhair_token')` e aceitava qualquer
 * URL em `softhair_server_url` sem validar HTTPS — caminho paralelo ao
 * `services/api.js` + backend embarcado. Foi neutralizado por segurança.
 *
 * O sync com cloud Render agora roda no backend embarcado
 * (backend/src/services/syncService.js) com tokens criptografados, TOFU
 * de cert e validação HTTPS. O frontend só fala com 127.0.0.1:3001.
 *
 * Limpa também as chaves antigas do localStorage no boot para reduzir leak.
 */

// P2-A3: limpar credenciais legadas que estavam em localStorage.
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('softhair_token');
    localStorage.removeItem('softhair_server_url');
    localStorage.removeItem('softhair_pending_changes');
    localStorage.removeItem('softhair_last_sync');
  }
} catch (_) { /* SSR / Node */ }

class DeprecatedSyncManager {
  constructor() {
    this._warned = false;
  }
  _warn(method) {
    if (this._warned) return;
    this._warned = true;
    console.warn(
      `[syncManager] DEPRECATED — sync agora é gerenciado pelo backend embarcado. Método "${method}" ignorado.`
    );
  }
  queueChange() { this._warn('queueChange'); }
  async syncData() { this._warn('syncData'); }
  async flushPendingChanges() { this._warn('flushPendingChanges'); }
  async applyRemoteChange() { this._warn('applyRemoteChange'); }
  async createCliente() { this._warn('createCliente'); return { success: false, error: 'deprecated' }; }
  async updateCliente() { this._warn('updateCliente'); return { success: false, error: 'deprecated' }; }
  async deleteCliente() { this._warn('deleteCliente'); return { success: false, error: 'deprecated' }; }
  async createAgendamento() { this._warn('createAgendamento'); return { success: false, error: 'deprecated' }; }
  async createVenda() { this._warn('createVenda'); return { success: false, error: 'deprecated' }; }
  async updateProdutoEstoque() { this._warn('updateProdutoEstoque'); return { success: false, error: 'deprecated' }; }
  async callAPI() { this._warn('callAPI'); return { success: false, error: 'deprecated' }; }
  async getClientes() { this._warn('getClientes'); return { success: false, error: 'deprecated' }; }
  async getAgendamentos() { this._warn('getAgendamentos'); return { success: false, error: 'deprecated' }; }
  async getProdutos() { this._warn('getProdutos'); return { success: false, error: 'deprecated' }; }
  async getServicos() { this._warn('getServicos'); return { success: false, error: 'deprecated' }; }
  async getProfissionais() { this._warn('getProfissionais'); return { success: false, error: 'deprecated' }; }
  getOnlineStatus() { return typeof navigator !== 'undefined' ? navigator.onLine : true; }
  getLastSync() { return null; }
  getPendingChangesCount() { return 0; }
}

const syncManager = new DeprecatedSyncManager();
export default syncManager;
