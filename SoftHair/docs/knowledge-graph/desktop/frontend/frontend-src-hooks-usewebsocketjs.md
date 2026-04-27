# frontend/src/hooks/useWebSocket.js

**Repository:** Desktop
**File:** `frontend/src/hooks/useWebSocket.js`
**Language:** `javascript`

---

#desktop #source

## Resumo

Arquivo `frontend/src/hooks/useWebSocket.js` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/sync|sync]]
- [[domains/state|state]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```javascript
import { useEffect, useRef } from 'react';

const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

function getWsUrl(tipo, id) {
  if (isFileProtocol) return `ws://localhost:3001/ws?tipo=${tipo}&id=${id}`;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws?tipo=${tipo}&id=${id}`;
}

export function useWebSocket(tipo, id, onMessage) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!tipo || !id) return;

    let ws;
    let reconnectTimer;
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      ws = new WebSocket(getWsUrl(tipo, id));

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.tipo !== 'conectado') onMessageRef.current(data);
        } catch {}
      };

      ws.onclose = () => {
        if (!unmounted) reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [tipo, id]);
}
```
