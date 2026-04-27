# src/services/websocketService.js

**Repository:** Server
**File:** `src/services/websocketService.js`
**Language:** `javascript`

---

#server #source

## Resumo

Arquivo `src/services/websocketService.js` do repositório Server.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/api|api]]
- [[domains/state|state]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const HEARTBEAT_INTERVAL = 30000; // 30s
const CLIENT_TIMEOUT = 45000; // 45s sem pong = desconectar

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.heartbeatTimer = null;
  }

  init(server) {
    this.wss = new WebSocket.Server({
      server,
      path: process.env.WS_PATH || '/ws'
    });

    this.wss.on('connection', (ws, req) => {
      console.log('[WS] Nova conexão WebSocket');
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(ws, data);
        } catch (error) {
          ws.send(JSON.stringify({ type: 'error', message: 'Mensagem inválida' }));
        }
      });

      ws.on('close', () => {
        this.removeClient(ws);
      });

      ws.on('error', (error) => {
        console.error('[WS] Erro:', error.message);
        this.removeClient(ws);
      });

      // Timeout de auth: se não autenticar em 10s, desconectar
      ws._authTimeout = setTimeout(() => {
        if (!this.clients.has(ws)) {
          ws.close(4001, 'Timeout de autenticação');
        }
      }, 10000);
    });

    // Heartbeat: verificar conexões mortas a cada 30s
    this.heartbeatTimer = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          console.log('[WS] Conexão morta detectada, terminando');
          this.removeClient(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, HEARTBEAT_INTERVAL);

    this.wss.on('close', () => {
      clearInterval(this.heartbeatTimer);
    });

    console.log('✅ WebSocket inicializado (heartbeat: 30s)');
  }

  handleMessage(ws, data) {
    switch (data.type) {
      case 'auth':
        this.authenticateClient(ws, data);
        break;
      case 'subscribe':
        this.subscribeClient(ws, data);
        break;
      case 'unsubscribe':
        this.unsubscribeClient(ws, data);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: `Tipo desconhecido: ${data.type}` }));
    }
  }

  /**
   * Autenticação via JWT (não aceita mais salaoId arbitrário)
   */
  authenticateClient(ws, data) {
    const { token } = data;

    if (!token) {
      ws.send(JSON.stringify({ type: 'auth', success: false, error: 'Token obrigatório' }));
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const clientInfo = {
        salaoId: decoded.salaoId,
        userId: decoded.userId,
        email: decoded.email,
        subscriptions: []
      };

      this.clients.set(ws, clientInfo);
      clearTimeout(ws._authTimeout);

      ws.send(JSON.stringify({
        type: 'auth',
        success: true,
        salaoId: decoded.salaoId
      }));

      console.log(`[WS] Cliente autenticado: ${decoded.email} (salão: ${decoded.salaoId})`);
    } catch (error) {
      ws.send(JSON.stringify({ type: 'auth', success: false, error: 'Token inválido' }));
      ws.close(4003, 'Token inválido');
    }
  }

  subscribeClient(ws, data) {
    const client = this.clients.get(ws);
    if (!client) {
      ws.send(JSON.stringify({ type: 'error', message: 'Autenticação necessária' }));
      return;
    }
    if (!client.subscriptions.includes(data.channel)) {
      client.subscriptions.push(data.channel);
    }
    ws.send(JSON.stringify({ type: 'subscribe', channel: data.channel, success: true }));
  }

  unsubscribeClient(ws, data) {
    const client = this.clients.get(ws);
    if (client) {
      client.subscriptions = client.subscriptions.filter(s => s !== data.channel);
    }
  }

  removeClient(ws) {
    clearTimeout(ws._authTimeout);
    this.clients.delete(ws);
  }

  /**
   * Broadcast para todos os clientes de um salão inscritos em um canal
   */
  broadcast(salaoId, channel, data) {
    let sent = 0;
    this.clients.forEach((client, ws) => {
      if (client.salaoId === salaoId && client.subscriptions.includes(channel)) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'broadcast', channel, data, timestamp: Date.now() }));
          sent++;
        }
      }
    });
    return sent;
  }

  /**
   * Notificar um salão inteiro (canal 'notifications')
   */
  notifySalao(salaoId, event, data) {
    return this.broadcast(salaoId, 'notifications', { event, data });
  }

  /**
   * Obter estatísticas de conexão
   */
  getStats() {
    const stats = { total: this.clients.size, bySalao: {} };
    this.clients.forEach((client) => {
      stats.bySalao[client.salaoId] = (stats.bySalao[client.salaoId] || 0) + 1;
    });
    return stats;
  }
}

module.exports = new WebSocketService();
```
