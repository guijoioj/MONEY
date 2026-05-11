const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

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
      path: process.env.WS_PATH || '/ws',
      // [A8] Validar JWT no handshake. Aceita ?token=... ou header Sec-WebSocket-Protocol.
      verifyClient: (info, cb) => {
        try {
          const url = new URL(info.req.url, 'http://x');
          const qToken = url.searchParams.get('token');
          const hToken = (info.req.headers['sec-websocket-protocol'] || '').split(',').map(s => s.trim()).find(Boolean);
          const token = qToken || hToken;
          if (!token) {
            // Não rejeita imediatamente — permite o fluxo de auth via mensagem ('auth') que já existe.
            // Mas marca como anônimo até autenticar.
            info.req._wsAnonymous = true;
            return cb(true);
          }
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          info.req._wsAuth = decoded;
          cb(true);
        } catch (e) {
          console.warn('[WS] handshake JWT inválido:', e.message);
          cb(false, 4001, 'Token inválido');
        }
      }
    });

    this.wss.on('connection', (ws, req) => {
      console.log('[WS] Nova conexão WebSocket');
      ws.isAlive = true;

      // Se autenticou via handshake (?token=...), já registra cliente
      if (req._wsAuth) {
        const decoded = req._wsAuth;
        this.clients.set(ws, {
          salaoId: decoded.salaoId,
          userId: decoded.userId || decoded.profissionalId || decoded.clienteAppId,
          email: decoded.email,
          subscriptions: []
        });
      }

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
      case 'CHAT_MESSAGE':
        this.handleChatMessage(ws, data);
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

  async handleChatMessage(ws, data) {
    const sender = this.clients.get(ws);
    if (!sender) {
      ws.send(JSON.stringify({ type: 'error', message: 'Autenticação necessária' }));
      return;
    }
    const { salaoId, remetenteId, remetenteTipo, destinatarioId, destinatarioTipo, mensagem } = data;
    if (!mensagem || !remetenteId || !remetenteTipo) {
      ws.send(JSON.stringify({ type: 'error', message: 'Campos obrigatórios: remetenteId, remetenteTipo, mensagem' }));
      return;
    }
    try {
      await query(
        'INSERT INTO chat_mensagens (salao_id, remetente_id, remetente_tipo, destinatario_id, destinatario_tipo, mensagem, created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())',
        [salaoId || sender.salaoId, remetenteId, remetenteTipo, destinatarioId || null, destinatarioTipo || null, mensagem]
      );
    } catch (err) {
      console.error('[WS] Erro ao salvar chat_mensagem:', err.message);
    }
    const payload = JSON.stringify({
      type: 'CHAT_MESSAGE',
      data: { salaoId: salaoId || sender.salaoId, remetenteId, remetenteTipo, destinatarioId, destinatarioTipo, mensagem, createdAt: new Date().toISOString() }
    });
    // Enviar para destinatário específico (se informado) ou broadcast do salão
    let delivered = false;
    if (destinatarioId) {
      this.clients.forEach((client, clientWs) => {
        if (client.userId === destinatarioId && clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(payload);
          delivered = true;
        }
      });
    }
    if (!delivered) {
      this.clients.forEach((client, clientWs) => {
        if (client.salaoId === (salaoId || sender.salaoId) && clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(payload);
        }
      });
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

  notificarSalao(salaoId, data) {
    return this.broadcast(salaoId, 'notifications', data);
  }

  notificarCliente(clienteId, data) {
    return this.broadcast(undefined, `cliente:${clienteId}`, data);
  }

  notificarProfissional(profissionalId, data) {
    return this.broadcast(undefined, `profissional:${profissionalId}`, data);
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
