# frontend/src/syncManager.js

**Repository:** Desktop
**File:** `frontend/src/syncManager.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `frontend/src/syncManager.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
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
 * SyncManager - Gerencia sincronização offline/online
 * Implementa padrão Offline-First simples com localStorage
 */

import axios from 'axios';

class SoftHairSyncManager {
  constructor() {
    this.pendingChanges = [];
    this.isOnline = navigator.onLine;
    this.lastSync = localStorage.getItem('softhair_last_sync');

    // Setup event listeners
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Load pending changes from localStorage
    this.loadPendingChanges();
  }

  handleOnline() {
    this.isOnline = true;
    console.log('📶 Online detectado, iniciando sincronização...');
    this.syncData();
  }

  handleOffline() {
    this.isOnline = false;
    console.log('📶 Offline detectado');
  }

  loadPendingChanges() {
    const saved = localStorage.getItem('softhair_pending_changes');
    if (saved) {
      this.pendingChanges = JSON.parse(saved);
    }
  }

  savePendingChanges() {
    localStorage.setItem('softhair_pending_changes', JSON.stringify(this.pendingChanges));
  }

  queueChange(table, operation, data) {
    this.pendingChanges.push({
      id: `pending-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      table,
      operation,
      data,
      attempts: 0
    });
    
    this.savePendingChanges();
    console.log('📦 Mudança enfileirada para sincronização:', { operation, table });
  }

  async syncData() {
    if (!this.isOnline) {
      console.log('📶 Sem conexão, ignorando sincronização');
      return;
    }

    try {
      console.log('🔄 Iniciando sincronização...');
      await this.flushPendingChanges();
      
      this.lastSync = new Date().toISOString();
      localStorage.setItem('softhair_last_sync', this.lastSync);
      
      console.log('✅ Sincronização completa');
      
      window.dispatchEvent(new CustomEvent('sync-complete'));
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
    }
  }

  async flushPendingChanges() {
    if (!this.isOnline || this.pendingChanges.length === 0) {
      console.log('✅ Nenhuma mudança pendente');
      return;
    }

    console.log(`📤 Flush: enviando ${this.pendingChanges.length} mudanças pendentes...`);
    
    for (let i = this.pendingChanges.length - 1; i >= 0; i--) {
      const change = this.pendingChanges[i];
      
      try {
        await this.applyRemoteChange(change);
        // Remove from pending
        this.pendingChanges.splice(i, 1);
      } catch (error) {
        change.attempts++;
        console.warn(`⚠️ Falha ao sincronizar mudança ${change.id}:`, error.message);
        if (change.attempts < 3) {
          setTimeout(() => this.syncData(), 5000); // Retry in 5s
        } else {
          console.error(`❌ Mudança ${change.id} falhou após 3 tentativas`);
        }
      }
    }
    
    this.savePendingChanges();
  }

  async applyRemoteChange(change) {
    const { operation, table, data } = change;
    
    const api = axios.create({
      baseURL: localStorage.getItem('softhair_server_url') + '/api' || import.meta.env.VITE_API_URL,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('softhair_token')}`,
        'Content-Type': 'application/json'
      }
    });

    switch (table) {
      case 'produtos':
        // Check endpoints available
        if (operation === 'UPDATE_ESTOQUE') {
          await api.put(`/produtos/${data.id}/estoque`, {
            quantidade: data.quantidade,
            tipo: data.tipo
          });
        }
        break;
      
      case 'clientes':
        if (operation === 'INSERT') {
      await api.post('/clientes', data);
        }
        break;
        
  case 'agendamentos':
        if (operation === 'INSERT') {
   await api.post('/agendamentos', data);
        }
  break;
  
      default:
        console.log('📘 Tabela:', table, ' - desconhecida, ignorando');
    }
  }

  // Proxy methods that work both online and offline
  async createCliente(data) {
    if (!this.isOnline) {
    this.queueChange('clientes', 'INSERT', data);
      return { success: true, data: { ...data, id: `local-${Date.now()}` }, offline: true };
    }
 return await this.callAPI('POST', '/clientes', data);
  }

  async updateCliente(id, data) {
    if (!this.isOnline) {
      this.queueChange('clientes', 'UPDATE', { id, ...data });
      return { success: true, data: { id, ...data },  offline: true };
    }
    return await this.callAPI('PUT', `/clientes/${id}`, data);
  }

  async deleteCliente(id) {
    if (!this.isOnline) {
      this.queueChange('clientes', 'DELETE', { id });
  return { success: true, message: 'Cliente removido offline', offline: true };
    }
 return await this.callAPI('DELETE', `/clientes/${id}`);
  }

  async createAgendamento(data) {
    if (!this.isOnline) {
      this.queueChange('agendamentos', 'INSERT', data);
    return { success: true, data: { ...data, id: `local-${Date.now()}` }, offline: true };
    }
   return await this.callAPI('POST', '/agendamentos', data);
  }

  async createVenda(data) {
    if (!this.isOnline) {
      this.queueChange('vendas', 'INSERT', data);
      return { success: true, data: { ...data, id: `local-${Date.now()}` }, offline: true };
    }
    return await this.callAPI('POST', '/vendas', data);
  }

  async updateProdutoEstoque(id, quantidade, tipo) {
    if (!this.isOnline) {
      this.queueChange('produtos', 'UPDATE_ESTOQUE', { id, quantidade, tipo });
  return { success: true, message: 'Estoque atualizado offline' , offline: true };
    }
    return await this.callAPI('PUT',`/produtos/${id}/estoque`, {
      quantidade,
      tipo
   });
  }

  async callAPI(method, endpoint, data = null) {
    try {
      const api = axios.create({
        baseURL: localStorage.getItem('softhair_server_url') + '/api' || import.meta.env.VITE_API_URL,
        timeout: 10000,
        headers: {
   'Authorization': `Bearer ${localStorage.getItem('softhair_token')}`,
     'Content-Type': 'application/json'
        }
      });

      let response;
  switch (method.toUpperCase()) {
        case 'GET':
     response = await api.get(endpoint);
          break;
        case 'POST':
          response = await api.post(endpoint, data);
            break;
        case 'PUT':
          response = await api.put(endpoint, data);
          break;
        case 'DELETE':
     response = await api.delete(endpoint);
   break;
 }
 
      return response.data;
    } catch (error) {
      return { 
  success: false, 
        error: error.response?.data?.error || error.message,
     details: error.response?.data
      };
    }
  }

  // Get methods only work when online
  async getClientes(filtros = {}) {
    if (!this.isOnline) {
   console.warn('📶 Offline - não é possível buscar dados do servidor');
   return { success: false, error: 'Sem conexão com servidor'  };
 }
    return await this.callAPI('GET', '/clientes', null);
  }

  async getAgendamentos(filtros = {}) {
    if (!this.isOnline) {
   console.warn('📶 Offline - não é possível buscar dados do servidor');
      return { success: false, error: 'Sem conexão com servidor' };
    }
    return await this.callAPI(  'GET','/agendamentos' );
  }

  async getProdutos(filtros = {}) {
    if (!this.isOnline) {
    console.warn('📶 Offline - não é possível buscar dados do servidor');
      return { success: false, error: 'Sem conexão com servidor'  };
    }
    return await this.callAPI('GET', '/produtos');
  }

  async getServicos(filtros = {}) {
    if (!this.isOnline) {
       console.warn('📶 Offline - não é possível buscar dados do servidor');
      return { success: false, error: 'Sem conexão com servidor' };
    }
    return await this.callAPI('GET', '/servicos');
  }

  async getProfissionais(filtros = {}) {
    if (!this.isOnline) {
      console.warn('📶 Offline - não é possível buscar dados do servidor');
   return { success: false, error: 'Sem conexão com servidor'  };
    }
  return await this.callAPI('GET', '/profissionais');
  }

  getOnlineStatus() {
    return this.isOnline;
  }

  getLastSync() {
    return this.lastSync;
  }

  getPendingChangesCount() {
    return this.pendingChanges.length;
  }
}

// Singleton instance
const syncManager = new SoftHairSyncManager();

export default syncManager;
```
