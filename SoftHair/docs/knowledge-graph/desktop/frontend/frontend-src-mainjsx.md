# frontend/src/main.jsx

**Repository:** Desktop
**File:** `frontend/src/main.jsx`
**Language:** `jsx`

---

#desktop #source

## Resumo

Arquivo `frontend/src/main.jsx` do repositório Desktop.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/database|database]]
- [[domains/api|api]]
- [[domains/state|state]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
const Router = isFileProtocol ? HashRouter : BrowserRouter;

if (isFileProtocol) {
  document.documentElement.classList.add('electron-app');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <App />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  </React.StrictMode>
);
```
