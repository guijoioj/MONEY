import { useEffect, useRef } from 'react';

/**
 * P4-C3: hook noop quando rodando dentro do Electron (file://).
 *
 * O backend embarcado NÃO expõe um servidor WebSocket — o handshake falha,
 * `onclose` agendava `setTimeout(connect, 5000)`, gerando loop infinito:
 *   - console floods do DevTools
 *   - TIME_WAIT sockets crescem no OS
 *   - webRequest filter (main.js) loga toda tentativa
 *
 * Quando o app rodar contra a versão cloud (browser HTTPS), o WS é fornecido
 * pelo SOFT-HAIR-SERVER, então mantemos a implementação ativa nesse caso.
 *
 * Roadmap: se o backend embarcado um dia receber `ws` server (Pass 5+), trocar
 * `WS_AVAILABLE` por feature detection (e.g. health endpoint expor `ws: true`).
 */
const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

// P4-C3: no Electron (file://) o backend embarcado não tem WS server.
// Bypass total — connect() não é chamado.
const WS_AVAILABLE = !isFileProtocol;

function getWsUrl(tipo, id) {
  // Mantido só para o branch cloud (HTTPS).
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws?tipo=${tipo}&id=${id}`;
}

export function useWebSocket(tipo, id, onMessage) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!tipo || !id) return;
    // P4-C3: noop em Electron — sem WS server local
    if (!WS_AVAILABLE) return;

    let ws;
    let reconnectTimer;
    let unmounted = false;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;

    const connect = () => {
      if (unmounted) return;
      try {
        ws = new WebSocket(getWsUrl(tipo, id));
      } catch (_) {
        // URL inválida ou WS bloqueado — não tenta de novo
        return;
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.tipo !== 'conectado') onMessageRef.current(data);
        } catch {}
      };

      ws.onopen = () => {
        reconnectAttempts = 0;
      };

      ws.onclose = () => {
        if (unmounted) return;
        // P4-C3: backoff exponencial com limite — antes era loop infinito a cada 5s
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 60000);
        reconnectAttempts++;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    };

    connect();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimer);
      if (ws) { try { ws.close(); } catch {} }
    };
  }, [tipo, id]);
}
