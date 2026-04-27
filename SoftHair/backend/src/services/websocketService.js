const WebSocket = require('ws');

let wss = null;
const clients = new Map();

function init(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const urlParams = new URLSearchParams(req.url.includes('?') ? req.url.split('?')[1] : '');
    const id = urlParams.get('id');
    const tipo = urlParams.get('tipo');

    if (id && tipo) {
      const key = `${tipo}:${id}`;
      if (!clients.has(key)) clients.set(key, new Set());
      clients.get(key).add(ws);

      ws.on('close', () => {
        const s = clients.get(key);
        if (s) { s.delete(ws); if (!s.size) clients.delete(key); }
      });

      ws.on('error', () => {});
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ tipo: 'conectado', mensagem: 'WebSocket conectado' }));
    }
  });
}

function enviar(tipo, id, payload) {
  const key = `${tipo}:${id}`;
  const conns = clients.get(key);
  if (!conns) return;
  const msg = JSON.stringify(payload);
  for (const ws of conns) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

function notificarSalao(salonId, payload) {
  enviar('salao', salonId, payload);
}

function notificarCliente(clienteAppId, payload) {
  enviar('cliente', clienteAppId, payload);
}

function notificarProfissional(profissionalId, payload) {
  enviar('profissional', profissionalId, payload);
}

module.exports = { init, notificarSalao, notificarCliente, notificarProfissional };
