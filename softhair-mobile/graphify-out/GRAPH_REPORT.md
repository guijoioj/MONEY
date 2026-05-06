# Graph Report - .  (2026-05-02)

## Corpus Check
- Corpus is ~13,924 words - fits in a single context window. You may not need a graph.

## Summary
- 83 nodes · 47 edges · 38 communities detected
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY__layout.tsx  _layout.tsx|_layout.tsx / _layout.tsx]]
- [[_COMMUNITY_ponto.tsx  baterPonto()|ponto.tsx / baterPonto()]]
- [[_COMMUNITY_websocket.ts  WebSocketManager|websocket.ts / WebSocketManager]]
- [[_COMMUNITY_formatDate()  formatHour()|formatDate() / formatHour()]]
- [[_COMMUNITY_formatarData()  formatarDataExibicao()|formatarData() / formatarDataExibicao()]]
- [[_COMMUNITY_perfil.tsx  perfil.tsx|perfil.tsx / perfil.tsx]]
- [[_COMMUNITY_carrinho.tsx  handleConfirmar()|carrinho.tsx / handleConfirmar()]]
- [[_COMMUNITY_atendimentos.tsx  formatDate()|atendimentos.tsx / formatDate()]]
- [[_COMMUNITY__layout.tsx  getDerivedStateFromError()|_layout.tsx / getDerivedStateFromError()]]
- [[_COMMUNITY_index.tsx  Index()|index.tsx / Index()]]
- [[_COMMUNITY__layout.tsx  AuthLayout()|_layout.tsx / AuthLayout()]]
- [[_COMMUNITY_login.tsx  handleLogin()|login.tsx / handleLogin()]]
- [[_COMMUNITY_register.tsx  handleRegister()|register.tsx / handleRegister()]]
- [[_COMMUNITY__layout.tsx  TabIcon()|_layout.tsx / TabIcon()]]
- [[_COMMUNITY_loja.tsx  handleAddToCart()|loja.tsx / handleAddToCart()]]
- [[_COMMUNITY_id.tsx  handleAddToCart()|[id].tsx / handleAddToCart()]]
- [[_COMMUNITY_Badge()  Badge.tsx|Badge() / Badge.tsx]]
- [[_COMMUNITY_Button()  Button.tsx|Button() / Button.tsx]]
- [[_COMMUNITY_Card()  Card.tsx|Card() / Card.tsx]]
- [[_COMMUNITY_useAuth.ts  useAuth()|useAuth.ts / useAuth()]]
- [[_COMMUNITY_babel.config.js|babel.config.js]]
- [[_COMMUNITY_metro.config.js|metro.config.js]]
- [[_COMMUNITY_nativewind-env.d.ts|nativewind-env.d.ts]]
- [[_COMMUNITY_tailwind.config.js|tailwind.config.js]]
- [[_COMMUNITY_expo-env.d.ts|expo-env.d.ts]]
- [[_COMMUNITY_meus-pedidos-loja.tsx|meus-pedidos-loja.tsx]]
- [[_COMMUNITY_pedidos.tsx|pedidos.tsx]]
- [[_COMMUNITY_index.tsx|index.tsx]]
- [[_COMMUNITY_id.tsx|[id].tsx]]
- [[_COMMUNITY__layout.tsx|_layout.tsx]]
- [[_COMMUNITY_comissoes.tsx|comissoes.tsx]]
- [[_COMMUNITY_Input.tsx|Input.tsx]]
- [[_COMMUNITY_Loading.tsx|Loading.tsx]]
- [[_COMMUNITY_api.ts|api.ts]]
- [[_COMMUNITY_authStore.ts|authStore.ts]]
- [[_COMMUNITY_carrinhoStore.ts|carrinhoStore.ts]]
- [[_COMMUNITY_wsStore.ts|wsStore.ts]]
- [[_COMMUNITY_security.ts|security.ts]]

## God Nodes (most connected - your core abstractions)
1. `WebSocketManager` - 5 edges
2. `WSConnector()` - 3 edges
3. `useWebSocket()` - 3 edges
4. `handleLogout()` - 2 edges
5. `formatDate()` - 2 edges
6. `navDate()` - 2 edges
7. `formatDate()` - 2 edges
8. `navDate()` - 2 edges
9. `useNotificacoes()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `WSConnector()` --calls--> `useWebSocket()`  [INFERRED]
  app/(profissional)/_layout.tsx → hooks/useWebSocket.ts
- `useWebSocket()` --calls--> `useNotificacoes()`  [INFERRED]
  hooks/useWebSocket.ts → hooks/useNotificacoes.ts

## Communities

### Community 0 - "_layout.tsx / _layout.tsx"
Cohesion: 0.22
Nodes (3): WSConnector(), useNotificacoes(), useWebSocket()

### Community 1 - "ponto.tsx / baterPonto()"
Cohesion: 0.29
Nodes (0): 

### Community 2 - "websocket.ts / WebSocketManager"
Cohesion: 0.33
Nodes (1): WebSocketManager

### Community 3 - "formatDate() / formatHour()"
Cohesion: 0.5
Nodes (2): formatDate(), navDate()

### Community 4 - "formatarData() / formatarDataExibicao()"
Cohesion: 0.5
Nodes (0): 

### Community 5 - "perfil.tsx / perfil.tsx"
Cohesion: 0.5
Nodes (1): handleLogout()

### Community 6 - "carrinho.tsx / handleConfirmar()"
Cohesion: 0.67
Nodes (0): 

### Community 7 - "atendimentos.tsx / formatDate()"
Cohesion: 1.0
Nodes (2): formatDate(), navDate()

### Community 8 - "_layout.tsx / getDerivedStateFromError()"
Cohesion: 1.0
Nodes (0): 

### Community 9 - "index.tsx / Index()"
Cohesion: 1.0
Nodes (0): 

### Community 10 - "_layout.tsx / AuthLayout()"
Cohesion: 1.0
Nodes (0): 

### Community 11 - "login.tsx / handleLogin()"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "register.tsx / handleRegister()"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "_layout.tsx / TabIcon()"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "loja.tsx / handleAddToCart()"
Cohesion: 1.0
Nodes (0): 

### Community 15 - "[id].tsx / handleAddToCart()"
Cohesion: 1.0
Nodes (0): 

### Community 16 - "Badge() / Badge.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Button() / Button.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "Card() / Card.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "useAuth.ts / useAuth()"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "babel.config.js"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "metro.config.js"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "nativewind-env.d.ts"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "tailwind.config.js"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "expo-env.d.ts"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "meus-pedidos-loja.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "pedidos.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "index.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "[id].tsx"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "_layout.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "comissoes.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Input.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Loading.tsx"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "api.ts"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "authStore.ts"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "carrinhoStore.ts"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "wsStore.ts"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "security.ts"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `_layout.tsx / getDerivedStateFromError()`** (2 nodes): `_layout.tsx`, `getDerivedStateFromError()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `index.tsx / Index()`** (2 nodes): `index.tsx`, `Index()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `_layout.tsx / AuthLayout()`** (2 nodes): `_layout.tsx`, `AuthLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `login.tsx / handleLogin()`** (2 nodes): `login.tsx`, `handleLogin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `register.tsx / handleRegister()`** (2 nodes): `register.tsx`, `handleRegister()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `_layout.tsx / TabIcon()`** (2 nodes): `_layout.tsx`, `TabIcon()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `loja.tsx / handleAddToCart()`** (2 nodes): `loja.tsx`, `handleAddToCart()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `[id].tsx / handleAddToCart()`** (2 nodes): `[id].tsx`, `handleAddToCart()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Badge() / Badge.tsx`** (2 nodes): `Badge()`, `Badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Button() / Button.tsx`** (2 nodes): `Button()`, `Button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Card() / Card.tsx`** (2 nodes): `Card()`, `Card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `useAuth.ts / useAuth()`** (2 nodes): `useAuth.ts`, `useAuth()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `babel.config.js`** (1 nodes): `babel.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `metro.config.js`** (1 nodes): `metro.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `nativewind-env.d.ts`** (1 nodes): `nativewind-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `tailwind.config.js`** (1 nodes): `tailwind.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `expo-env.d.ts`** (1 nodes): `expo-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `meus-pedidos-loja.tsx`** (1 nodes): `meus-pedidos-loja.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `pedidos.tsx`** (1 nodes): `pedidos.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `index.tsx`** (1 nodes): `index.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `[id].tsx`** (1 nodes): `[id].tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `_layout.tsx`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `comissoes.tsx`** (1 nodes): `comissoes.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Input.tsx`** (1 nodes): `Input.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Loading.tsx`** (1 nodes): `Loading.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `api.ts`** (1 nodes): `api.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `authStore.ts`** (1 nodes): `authStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `carrinhoStore.ts`** (1 nodes): `carrinhoStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `wsStore.ts`** (1 nodes): `wsStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `security.ts`** (1 nodes): `security.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Are the 2 inferred relationships involving `useWebSocket()` (e.g. with `WSConnector()` and `useNotificacoes()`) actually correct?**
  _`useWebSocket()` has 2 INFERRED edges - model-reasoned connections that need verification._