const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const HEARTBEAT_INTERVAL = 30000; // 30s
const CLIENT_TIMEOUT = 45000; // 45s sem pong = desconectar

// [P5-A8] Limite de conexões WS por user (default 5)
const MAX_CONNECTIONS_PER_USER = parseInt(process.env.WS_MAX_CONNECTIONS_PER_USER) || 5;

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    // [P5-A8] Tracking de conexões por userId (string composto: type:userId)
    this.connectionsByUser = new Map();
    this.heartbeatTimer = null;
  }

  _userKey(decoded) {
    const uid = decoded.userId || decoded.profissionalId || decoded.clienteAppId || decoded.clienteId || 'anon';
    const t = decoded.type || 'admin';
    return `${t}:${uid}`;
  }

  _incUserConn(key) {
    const cur = this.connectionsByUser.get(key) || 0;
    this.connectionsByUser.set(key, cur + 1);
    return cur + 1;
  }

  _decUserConn(key) {
    if (!key) return;
    const cur = this.connectionsByUser.get(key) || 0;
    if (cur <= 1) this.connectionsByUser.delete(key);
    else this.connectionsByUser.set(key, cur - 1);
  }

  init(server) {
    this.wss = new WebSocket.Server({
      server,
      path: process.env.WS_PATH || '/ws',
      // [P4-M4] Limite explícito de payload — sem isso, ws@8 aceita até 100MiB,
      // permitindo DoS via JSON.parse síncrono de mensagem gigante. 64KB > suficiente.
      maxPayload: 64 * 1024,
      // [A8/P2-M2] Validar JWT no handshake. Token é OBRIGATÓRIO — sem token, rejeita.
      // Aceita ?token=... ou header Sec-WebSocket-Protocol. Sem fallback legacy.
      verifyClient: (info, cb) => {
        try {
          // [P3-M4] Defense-in-depth: validar Origin contra ALLOWED_ORIGINS.
          // Mobile (React Native) NÃO envia Origin — permitido (autenticação JWT cobre).
          // Web/browser DEVE bater com a allowlist.
          const origin = info.req.headers.origin;
          if (origin) {
            const allowed = (process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean)) || [];
            const hasWildcard = allowed.includes('*');
            if (!hasWildcard && !allowed.includes(origin)) {
              console.warn(`[WS] Origin não permitido: ${origin}`);
              return cb(false, 4003, 'Origin não permitido');
            }
          }

          const url = new URL(info.req.url, 'http://x');
          const qToken = url.searchParams.get('token');
          const hToken = (info.req.headers['sec-websocket-protocol'] || '').split(',').map(s => s.trim()).find(Boolean);
          const token = qToken || hToken;
          if (!token) {
            // [P2-M2] Token obrigatório — não permite mais auth-via-mensagem.
            console.warn('[WS] handshake sem token — rejeitando');
            return cb(false, 4001, 'Token obrigatório no handshake');
          }
          // [P4-M1] Travar algorithm em HS256.
          const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
          // [P5-A8] Limite de conexões simultâneas por user — recusa nova conexão acima do cap.
          const userKey = this._userKey(decoded);
          const currentConns = this.connectionsByUser.get(userKey) || 0;
          if (currentConns >= MAX_CONNECTIONS_PER_USER) {
            console.warn(`[WS] Limite de ${MAX_CONNECTIONS_PER_USER} conexões atingido para ${userKey}`);
            return cb(false, 4002, 'Limite de conexões WS atingido');
          }
          info.req._wsAuth = decoded;
          info.req._wsUserKey = userKey;
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
        const userKey = req._wsUserKey || this._userKey(decoded);
        ws._wsUserKey = userKey; // [P5-A8] guardar para decrement no close
        this._incUserConn(userKey);
        this.clients.set(ws, {
          salaoId: decoded.salaoId,
          userId: decoded.userId || decoded.profissionalId || decoded.clienteAppId || decoded.clienteId,
          // [P2-C1] type vem do JWT — usado para validação de chat cross-tenant
          type: decoded.type || 'admin',
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

      // [P3-B8] Auth-timeout removido — handshake já exige token (verifyClient).
      // Toda conexão que chega aqui está autenticada; o timer era dead code.
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
        // [P2-M2] Auth-via-mensagem foi descontinuado — token é obrigatório no handshake.
        ws.send(JSON.stringify({
          type: 'auth',
          success: false,
          error: 'Auth via mensagem foi descontinuado. Envie o token no handshake (?token=...).'
        }));
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
   * [P6-B1] DEAD CODE — não chamado de handleMessage (que retorna erro genérico em 'auth').
   * Mantido apenas com algorithms HS256 travado caso algum refactor o reative.
   */
  authenticateClient(ws, data) {
    const { token } = data;

    if (!token) {
      ws.send(JSON.stringify({ type: 'auth', success: false, error: 'Token obrigatório' }));
      return;
    }

    try {
      // [P6-B1] Travar algorithm em HS256 — evita alg confusion se rota for reativada.
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      const clientInfo = {
        salaoId: decoded.salaoId,
        userId: decoded.userId,
        email: decoded.email,
        subscriptions: []
      };

      this.clients.set(ws, clientInfo);

      ws.send(JSON.stringify({
        type: 'auth',
        success: true,
        salaoId: decoded.salaoId
      }));

      // [B3] Não loga email/PII — apenas tenant + tipo
      console.log(`[WS] Cliente autenticado (salão: ${decoded.salaoId}, type: ${decoded.type || 'admin'})`);
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
    // [P3-B4] Cap de subscriptions por conexão (50) — evita memory bloat.
    const MAX_SUBSCRIPTIONS = 50;
    if (client.subscriptions.length >= MAX_SUBSCRIPTIONS && !client.subscriptions.includes(data.channel)) {
      ws.send(JSON.stringify({ type: 'error', message: `Limite de ${MAX_SUBSCRIPTIONS} subscriptions atingido` }));
      return;
    }
    // [P4-B5] Restringir canais admin-only para tokens admin. Tokens de cliente/profissional
    // só podem subscrever seus próprios canais (cliente:<id>, profissional:<id>).
    const channel = String(data.channel || '');
    if (client.type === 'cliente') {
      const isOwnChannel = channel === `cliente:${client.userId}`;
      if (!isOwnChannel) {
        ws.send(JSON.stringify({ type: 'error', message: 'Canal não permitido para este tipo de token' }));
        return;
      }
    } else if (client.type === 'profissional') {
      const isOwnChannel = channel === `profissional:${client.userId}`;
      if (!isOwnChannel) {
        ws.send(JSON.stringify({ type: 'error', message: 'Canal não permitido para este tipo de token' }));
        return;
      }
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
    // [P2-C1] NUNCA confiar em salaoId/remetenteId/remetenteTipo do cliente.
    // Tudo vem do JWT verificado no handshake. Cliente só pode forjar mensagem
    // em nome de outro usuário/salão se conseguir falsificar o JWT (impossível
    // sem JWT_SECRET).
    const { destinatarioId, destinatarioTipo, mensagem } = data;
    if (!mensagem || typeof mensagem !== 'string' || !mensagem.trim()) {
      ws.send(JSON.stringify({ type: 'error', message: 'Campo obrigatório: mensagem' }));
      return;
    }

    const salaoId = sender.salaoId;
    const remetenteId = sender.userId;
    const remetenteTipo = sender.type || 'admin';

    // [P2-C1] Validar que destinatarioId pertence ao mesmo salão (defense in depth).
    if (destinatarioId) {
      try {
        const tabela = destinatarioTipo === 'cliente'
          ? 'clientes'
          : destinatarioTipo === 'profissional'
            ? 'profissionais'
            : 'usuarios';
        // Whitelist de tabelas para evitar injection
        if (!['clientes', 'profissionais', 'usuarios'].includes(tabela)) {
          ws.send(JSON.stringify({ type: 'error', message: 'destinatarioTipo inválido' }));
          return;
        }
        const owns = await query(
          `SELECT 1 FROM ${tabela} WHERE id = $1 AND salao_id = $2`,
          [destinatarioId, salaoId]
        );
        if (!owns.length) {
          ws.send(JSON.stringify({ type: 'error', message: 'destinatário não pertence ao salão' }));
          return;
        }
      } catch (err) {
        console.error('[WS] erro ao validar destinatário:', err.message);
        return;
      }
    }

    try {
      await query(
        'INSERT INTO chat_mensagens (salao_id, remetente_id, remetente_tipo, destinatario_id, destinatario_tipo, mensagem, created_at) VALUES ($1,$2,$3,$4,$5,$6,NOW())',
        [salaoId, remetenteId, remetenteTipo, destinatarioId || null, destinatarioTipo || null, mensagem]
      );
    } catch (err) {
      console.error('[WS] Erro ao salvar chat_mensagem:', err.message);
    }
    const payload = JSON.stringify({
      type: 'CHAT_MESSAGE',
      data: { salaoId, remetenteId, remetenteTipo, destinatarioId, destinatarioTipo, mensagem, createdAt: new Date().toISOString() }
    });
    // Enviar para destinatário específico (se informado) ou broadcast do salão
    let delivered = false;
    if (destinatarioId) {
      this.clients.forEach((client, clientWs) => {
        // [P2-C1] Só entrega se o destinatário estiver no MESMO salão do remetente.
        if (client.userId === destinatarioId && client.salaoId === salaoId && clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(payload);
          delivered = true;
        }
      });
    }
    if (!delivered) {
      this.clients.forEach((client, clientWs) => {
        if (client.salaoId === salaoId && clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(payload);
        }
      });
    }
  }

  removeClient(ws) {
    // [P3-B8] _authTimeout removido; nada a limpar aqui além do Map.
    // [P5-A8] Decrementa contagem de conexões por user.
    if (ws._wsUserKey) {
      this._decUserConn(ws._wsUserKey);
      ws._wsUserKey = null;
    }
    this.clients.delete(ws);
  }

  /**
   * Broadcast para todos os clientes inscritos em um canal.
   * [P6-B4] Se salaoId for nullish, ignora o filtro de salão — usado por
   * notificarCliente/notificarProfissional que entregam por canal específico
   * (cliente:<id>, profissional:<id>) independentemente do salão.
   */
  broadcast(salaoId, channel, data) {
    let sent = 0;
    this.clients.forEach((client, ws) => {
      const salaoMatch = (salaoId == null) || client.salaoId === salaoId;
      if (salaoMatch && client.subscriptions.includes(channel)) {
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
