# Auditoria Completa do Repositório Mobile - SoftHair

**Data**: 2026-05-19  
**Repositório**: `/home/ogejota/Documentos/SOFTHAIR/MONEY/softhair-mobile/`  
**Framework**: React Native + Expo Router v6.0.23  
**Banco de Dados State**: Zustand + React Query

---

## 1. Estrutura de Pastas

```
softhair-mobile/
├── app/                                    # Rotas Expo Router (file-based)
│   ├── index.tsx                           # Root redirect (auth check)
│   ├── _layout.tsx                         # Root stack com ErrorBoundary + QueryClient
│   ├── (auth)/                             # Grupo de autenticação
│   │   ├── _layout.tsx                     # Stack layout para auth
│   │   ├── login.tsx                       # Login (tabs: cliente/profissional)
│   │   └── register.tsx                    # Registro apenas cliente
│   ├── (cliente)/                          # Grupo cliente
│   │   ├── _layout.tsx                     # Stack parent
│   │   ├── (tabs)/                         # Tabs layout cliente
│   │   │   ├── _layout.tsx                 # Tabs: inicio, pedidos, loja, carrinho, meus-pedidos-loja, perfil
│   │   │   ├── index.tsx                   # Dashboard salões públicos (busca)
│   │   │   ├── pedidos.tsx                 # Meus agendamentos
│   │   │   ├── loja.tsx                    # Loja de produtos por salão
│   │   │   ├── carrinho.tsx                # Carrinho multi-salão com checkout modal
│   │   │   ├── meus-pedidos-loja.tsx       # Pedidos de loja (STUB?)
│   │   │   ├── perfil.tsx                  # Editar perfil + logout cliente
│   │   │   └── agendar.tsx                 # (href: null - hidden route)
│   │   ├── salao/[id].tsx                  # Detalhes salão (modal/drawer?)
│   │   └── produto/[id].tsx                # Detalhes produto (modal/drawer?)
│   └── (profissional)/                     # Grupo profissional
│       ├── _layout.tsx                     # Stack parent
│       └── (tabs)/                         # Tabs layout profissional
│           ├── _layout.tsx                 # Tabs: agenda, ponto, atendimentos, comissoes, produtos-atendimento, chat, perfil
│           ├── agenda.tsx                  # Agenda diária com navegação data + modal atraso
│           ├── ponto.tsx                   # Time tracking (entrada/saída/pausa) + atendimentos
│           ├── atendimentos.tsx            # Histórico atendimentos (REAL)
│           ├── comissoes.tsx               # Comissões (READ-ONLY, consumo /api)
│           ├── produtos-atendimento.tsx    # Produtos do salão (STUB)
│           ├── chat.tsx                    # Chat com admin/recepção via WebSocket
│           └── perfil.tsx                  # (não encontrado)
├── components/                             # UI components
│   └── ui/
│       ├── Badge.tsx                       # Status badge (hard-coded colors?)
│       ├── Button.tsx                      # Botão primário/outline/ghost/danger
│       ├── Card.tsx                        # Container card
│       ├── Input.tsx                       # Input text/email/phone/password
│       └── Loading.tsx                     # Spinner + SkeletonCard
├── store/                                  # Zustand stores
│   ├── authStore.ts                        # Auth + token management (SecureStore)
│   ├── carrinhoStore.ts                    # Carrinho cliente multi-salão
│   └── wsStore.ts                          # WebSocket notificações (unread count)
├── services/                               # API + WebSocket
│   ├── api.ts                              # Axios instance com interceptors
│   └── websocket.ts                        # WebSocket manager + reconnect
├── hooks/                                  # Custom React hooks
│   ├── useAuth.ts                          # Login/logout + push token registration
│   ├── useNotificacoes.ts                  # Stub vazio (useCallback sem implementação)
│   └── useWebSocket.ts                     # (referenciado em imports?)
├── utils/                                  # Utilities
│   └── security.ts                         # encryptedStorage (AES + SecureStore)
├── assets/                                 # Icons, splash, etc
├── .claude/                                # Claude Code config
│   └── launch.json                         # Dev server config
├── app.json                                # Expo config
├── package.json                            # Dependencies
├── tsconfig.json                           # TypeScript config
├── eas.json                                # EAS Build config
├── expo-env.d.ts                           # Expo types
├── nativewind-env.d.ts                     # NativeWind types
└── global.css                              # Tailwind config (NativeWind)
```

---

## 2. Dependências Principais (package.json)

| Pacote | Versão | Propósito |
|--------|--------|----------|
| expo | ~54.0.34 | React Native framework |
| expo-router | ~6.0.23 | File-based routing |
| react-native | 0.81.5 | Native runtime |
| react | ^19.1.0 | React (latest) |
| @tanstack/react-query | ^5.40.0 | Server state management |
| zustand | ^4.5.4 | Client state (auth, carrinho, ws) |
| axios | ^1.7.2 | HTTP client |
| nativewind | ^4.1.23 | Tailwind CSS para RN |
| expo-secure-store | ~15.0.8 | Keychain/Keystore para JWT |
| @react-native-async-storage/async-storage | 2.2.0 | Persistência dados não-sensíveis |
| expo-notifications | ~0.32.17 | Push notifications |
| @react-native-community/datetimepicker | 8.4.4 | Date/time picker |
| expo-device | ~8.0.10 | Device info |
| crypto-js | ^4.2.0 | AES encryption (utils/security.ts) |

**TypeScript**: ~5.9.2 (strict mode ativado)

---

## 3. Login Flow

### 3.1 Armazenamento de Token

**Arquivo**: `/home/ogejota/Documentos/SOFTHAIR/MONEY/softhair-mobile/store/authStore.ts`

- **Token**: Armazenado em `expo-secure-store` (Keychain iOS / Keystore Android)
  - Chave: `softhair_token`
  - Migração legacy de `AsyncStorage` (@softhair:token) → SecureStore (com remoção do legacy)
  - Se SecureStore falhar em dev: token fica APENAS em memória (Zustand state)
  - Sessão perdida ao fechar app se SecureStore indisponível
- **Dados não-sensíveis** (user, userType): AsyncStorage
  - Chaves: `@softhair:user`, `@softhair:userType`

### 3.2 Fluxo de Login

**Arquivo**: `/home/ogejota/Documentos/SOFTHAIR/MONEY/softhair-mobile/app/(auth)/login.tsx`

1. **Tela de login** (`login.tsx`)
   - Tabs: **Cliente** / **Profissional**
   - Campos: Email + Senha
   - Validação: Email/senha preenchidos antes de envio

2. **Cliente Login** (`useAuth.loginCliente`)
   - `POST /app/auth/login` → `{ email, password }`
   - Resposta: `{ user, token }`
   - Salva token + user (com `clienteAppId` normalizando `user.id`)
   - Conecta WebSocket: `wsManager.connect(user.id, 'cliente')`
   - Registra push token: `PUT /app/auth/push-token`
   - Redireciona: `/(cliente)/(tabs)`

3. **Profissional Login** (`useAuth.loginProfissional`)
   - `POST /app/profissional/auth/login` → `{ email, password }`
   - Resposta: `{ user, token }`
   - Conecta WebSocket: `wsManager.connect(user.profissionalId, 'profissional')`
   - Registra push token: `PUT /app/profissional/auth/push-token`
   - Redireciona: `/(profissional)/(tabs)`

4. **Registro Cliente** (`register.tsx`)
   - `POST /app/auth/register` → `{ nome, email, password, telefone }`
   - Mesmo fluxo pós-login

### 3.3 Restauração de Sessão

**Arquivo**: `/home/ogejota/Documentos/SOFTHAIR/MONEY/softhair-mobile/app/_layout.tsx`

- `useAuthStore.loadFromStorage()` chamado em `useEffect` no RootLayoutNav
- Lê token de SecureStore + user de AsyncStorage
- Timeout de 3s para evitar travamento
- Se autenticado:
  - Reconecta WebSocket no `useEffect` com dependências `[isAuthenticated, user, userType]`
- Se não autenticado: redireciona para `/(auth)/login`

### 3.4 Logout

**Arquivo**: `/home/ogejota/Documentos/SOFTHAIR/MONEY/softhair-mobile/hooks/useAuth.ts`

- `useAuth.logout()`:
  - Desconecta WebSocket: `wsManager.disconnect()`
  - Remove token de SecureStore + AsyncStorage
  - Limpa user/userType/token no Zustand
  - Redireciona: `/(auth)/login`

### 3.5 Refresh Token

**Status**: NÃO IMPLEMENTADO ❌
- Se API retorna 401, interceptor apenas deleta token
- Não há mecanismo de refresh automático
- Usuário precisa fazer login novamente

---

## 4. Configuração de API Base URL

**Arquivo**: `/home/ogejota/Documentos/SOFTHAIR/MONEY/softhair-mobile/services/api.ts`

```typescript
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.15.185:3001';
```

- **Default**: `http://192.168.15.185:3001` (IP local de dev)
- **Override via env**: `EXPO_PUBLIC_API_URL` (variável Expo pública)
- **Hardcoded**: Sem tela de configuração de servidor no app
- **WebSocket**: Converte `http://` → `ws://` automaticamente

### 4.1 Interceptadores Axios

1. **Request Interceptor**:
   - Injeta `Authorization: Bearer {token}` via `tokenStorage.getToken()`
   - Busca token assincronamente a cada request

2. **Response Interceptor**:
   - Status 401 → Deleta token, limpa AsyncStorage
   - Erros: Mapeia `error.response.data.error/message` → `error.userMessage`
   - Timeout (ECONNABORTED): "Tempo de conexão esgotado"
   - Sem resposta: "Sem conexão com o servidor"

---

## 5. Roteamento (Expo Router)

**Arquivo principal**: `/home/ogejota/Documentos/SOFTHAIR/MONEY/softhair-mobile/app/_layout.tsx`

### 5.1 Stack Root

```
/ (RootLayout Stack)
├── (auth)
│   ├── login
│   └── register
├── (cliente)
│   ├── (tabs)
│   │   ├── index (Início)
│   │   ├── pedidos (Agendamentos)
│   │   ├── loja (Loja)
│   │   ├── carrinho (Carrinho)
│   │   ├── meus-pedidos-loja (Pedidos Loja)
│   │   ├── perfil (Perfil)
│   │   └── agendar (href: null - hidden)
│   ├── salao/[id]
│   └── produto/[id]
└── (profissional)
    └── (tabs)
        ├── agenda
        ├── ponto
        ├── atendimentos
        ├── comissoes
        ├── produtos-atendimento
        ├── chat
        └── perfil
```

### 5.2 Redirecionamento Automático (index.tsx)

```typescript
// Root redirect baseado em auth state
- Não autenticado → /(auth)/login
- Profissional → /(profissional)/(tabs)/agenda
- Cliente → /(cliente)/(tabs)
```

### 5.3 Rotas Dinâmicas

- `/(cliente)/salao/[id]`: Recebe `id` via `useLocalSearchParams()`
- `/(cliente)/produto/[id]`: Recebe `id`, `salonId`, `salaoNome`

---

## 6. Services

### 6.1 API Service (`services/api.ts`)

- **Axios instance** com baseURL configurável
- **Timeout**: 10000ms
- **Headers padrão**: `Content-Type: application/json`
- **Request interceptor**: Injeta Authorization header
- **Response interceptor**: Trata 401, mapeia erros
- Exportado como `default`

### 6.2 WebSocket Service (`services/websocket.ts`)

**Classe**: `WebSocketManager` (singleton `wsManager`)

**Métodos**:
- `connect(userId, userType)`: Conecta ao WebSocket
- `disconnect()`: Desconecta e para de reconectar
- `addListener(callback)`: Escuta eventos genéricos
- `onMessage(callback)`: Escuta mensagens brutas (compatível com CHAT_MESSAGE)
- `send(payload)`: Envia mensagem JSON
- `isConnected()`: Status atual

**Features**:
- Reconexão automática com backoff exponencial (3s → 30s max)
- URL: `{baseURL}/ws?tipo={userType}&id={userId}`
- Exemplo: `ws://192.168.15.185:3001/ws?tipo=profissional&id=abc123`
- Eventos esperados: `{ tipo, titulo?, mensagem?, pedido?, agendamento?, ... }`

---

## 7. Stores (Zustand)

### 7.1 Auth Store (`store/authStore.ts`)

```typescript
interface AuthState {
  user: AuthUser | null
  token: string | null
  userType: 'cliente' | 'profissional' | null
  isLoading: boolean
  isAuthenticated: boolean
  
  setAuth(user, token, type): Promise<void>
  logout(): Promise<void>
  loadFromStorage(): Promise<void>
}

// Exporta tokenStorage para uso em api.ts
export const tokenStorage = { setToken, getToken, deleteToken }
```

### 7.2 Carrinho Store (`store/carrinhoStore.ts`)

```typescript
interface CarrinhoItem {
  produtoId: string
  nome: string
  preco: number
  quantidade: number
  salonId: string
  salaoNome: string
}

interface CarrinhoState {
  itens: CarrinhoItem[]
  addItem(item): void
  removeItem(produtoId): void
  updateQuantidade(produtoId, qty): void
  limparCarrinho(): void
  limparSalao(salonId): void
  total(salonId?): number
  itensPorSalao(): Record<string, CarrinhoItem[]>
}
```

- Multi-salão: Agrupa itens por `salonId`
- Persistência: **NÃO** (localStorage em Zustand padrão)
- Limpo no logout? **NÃO** observado explicitamente

### 7.3 WebSocket Store (`store/wsStore.ts`)

```typescript
interface WSState {
  notificacoesNaoLidas: number
  ultimaNotificacao: WSEvent | null
  incrementar(): void
  zerarNotificacoes(): void
  setUltimaNotificacao(event): void
}
```

- Contador de notificações não-lidas
- Última notificação recebida
- Integração com `wsManager` via hooks

---

## 8. Telas Implementadas vs Stubs

| Rota | Arquivo | Status | Observações |
|------|---------|--------|-------------|
| **(auth)** | | | |
| `/login` | `app/(auth)/login.tsx` | ✅ REAL | Tabs cliente/prof, validação, API calls |
| `/register` | `app/(auth)/register.tsx` | ✅ REAL | Cliente apenas, 6+ chars senha |
| **(cliente)** | | | |
| `/(cliente)/(tabs)` | `index.tsx` | ✅ REAL | Dashboard: busca de salões públicos |
| `/(cliente)/(tabs)/pedidos` | `pedidos.tsx` | ✅ REAL | Agendamentos (status badges) |
| `/(cliente)/(tabs)/loja` | `loja.tsx` | ✅ REAL | Produtos com seletor de salão, add carrinho |
| `/(cliente)/(tabs)/carrinho` | `carrinho.tsx` | ✅ REAL | Multi-salão, checkout modal (4 formas) |
| `/(cliente)/(tabs)/meus-pedidos-loja` | `meus-pedidos-loja.tsx` | ⚠️ STUB? | Nome sugere implementação, mas não lido |
| `/(cliente)/(tabs)/perfil` | `perfil.tsx` | ✅ REAL | Editar nome/telefone, logout |
| `/(cliente)/salao/[id]` | `salao/[id].tsx` | ❓ NÃO ENCONTRADO | Rota referenciada em `index.tsx` |
| `/(cliente)/produto/[id]` | `produto/[id].tsx` | ❓ NÃO ENCONTRADO | Rota referenciada em `loja.tsx` |
| **(profissional)** | | | |
| `/(profissional)/(tabs)/agenda` | `agenda.tsx` | ✅ REAL | Dia a dia, navegação data, modal atraso |
| `/(profissional)/(tabs)/ponto` | `ponto.tsx` | ✅ REAL | Time tracking, atendimentos, produtos |
| `/(profissional)/(tabs)/atendimentos` | `atendimentos.tsx` | ✅ REAL | Histórico com datas, filtro |
| `/(profissional)/(tabs)/comissoes` | `comissoes.tsx` | ✅ REAL | Read-only, GET /api/profissional/comissoes |
| `/(profissional)/(tabs)/produtos-atendimento` | `produtos-atendimento.tsx` | ⚠️ PARCIAL | Busca/lista, registra uso, mas UI básica |
| `/(profissional)/(tabs)/chat` | `chat.tsx` | ✅ REAL | Histórico via API, WebSocket CHAT_MESSAGE |
| `/(profissional)/(tabs)/perfil` | - | ❌ NÃO ENCONTRADO | Tab listado no _layout mas sem arquivo |

---

## 9. Comissão no Mobile

**Arquivo**: `/home/ogejota/Documentos/SOFTHAIR/MONEY/softhair-mobile/app/(profissional)/(tabs)/comissoes.tsx`

### 9.1 Implementação Atual

- ✅ **Tela completa**: Comissões (profissional only)
- ✅ **API**: `GET /app/profissional/comissoes`
- ✅ **Response**: `{ data: Comissao[], totalPago: number }`
- ✅ **UI**: Header com total, lista com refresh control
- ✅ **Estrutura Comissao**:
  ```typescript
  {
    id: string,
    valor: number,
    dataPagamento: string,
    observacoes?: string
  }
  ```

### 9.2 Funcionalidades

| Função | Status |
|--------|--------|
| Listar comissões | ✅ GET com React Query |
| Calcular total | ✅ Sum no response (`totalPago`) |
| Filtro por data | ❌ Não implementado |
| Filtro por status | ❌ Não há status field |
| Histórico detalhado | ⚠️ Apenas valor + data + obs |
| Adicionar comissão (admin) | ❌ Sem UI (seria admin-only) |
| Editar/Deletar | ❌ Não implementado |

### 9.3 Gaps vs Fase 8

**Fase 8 do servidor** requer:
- Comissões por serviço/venda
- Relatório detalhado (filtros data, salão, profissional)
- Dashboard admin: distribuição comissões
- Webhooks de comissão

**Mobile atual**:
- ✅ Read-only básico
- ❌ Sem filtros
- ❌ Sem analytics
- ❌ Sem componente admin

---

## 10. Notificações Push

**Arquivo**: `/home/ogejota/Documentos/SOFTHAIR/MONEY/softhair-mobile/hooks/useAuth.ts`

### 10.1 Registro de Push Token

```typescript
async function registerPushToken(userType: 'cliente' | 'profissional') {
  if (!Device.isDevice) return; // Skip Expo Go
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  const endpoint = userType === 'profissional'
    ? '/app/profissional/auth/push-token'
    : '/app/auth/push-token';
  await api.put(endpoint, { pushToken: token });
}
```

- ✅ **Configurado**: `expo-notifications` no app.json
- ✅ **Permissões**: Pede ao usuário
- ✅ **Tokens registrados**: `PUT /app/auth/push-token` (cliente) e `/app/profissional/auth/push-token` (prof)
- ✅ **Chamado em**: `loginCliente()`, `loginProfissional()`, `registerCliente()`
- ⚠️ **Sem confirmação UI**: Apenas warning silencioso se falhar

### 10.2 Notification Handler

```typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
```

- Todas as notificações aparecem (alerts, som, badge)

### 10.3 Hook useNotificacoes

**Arquivo**: `/home/ogejota/Documentos/SOFTHAIR/MONEY/softhair-mobile/hooks/useNotificacoes.ts`

```typescript
export function useNotificacoes() {
  const mostrarNotificacao = useCallback(async (_titulo: string, _corpo: string) => {}, []);
  return { mostrarNotificacao };
}
```

- ❌ **STUB VAZIO**: Função sem implementação
- Não consumida em nenhuma tela observada

---

## 11. TypeScript

**Arquivo**: `/home/ogejota/Documentos/SOFTHAIR/MONEY/softhair-mobile/tsconfig.json`

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] }
  }
}
```

- ✅ **Strict mode**: Ativado
- ✅ **Path alias**: `@/` para imports
- ⚠️ **Erros visíveis?**: Não testado, mas nenhuma evidência de type errors observados no código
- Tipagem completa em stores, hooks, services

---

## 12. NativeWind

**Arquivo**: `app/(auth)/login.tsx` e outros

- ✅ **Configurado**: `nativewind@4.1.23`
- ✅ **Uso**: `className="flex-1 px-6 pt-20"` em View, Text, etc
- ✅ **TailwindCSS**: `^3.4.0` como dep
- ✅ **Tipos**: `nativewind-env.d.ts` presente
- ✅ **Cores custom**: Padrão (`bg-primary`, `text-muted`) mapeado em theme

**Cores observadas**:
- `bg-primary` → `#db2777` (pink)
- `bg-secondary` → `#6366f1` (indigo)
- `bg-background` → `#f9fafb` (quase-branco)
- `text-text` → `#111827` (quase-preto)
- `text-muted` → `#9ca3af` (gray-400)

---

## 13. Componentes UI

| Componente | Arquivo | Features |
|------------|---------|----------|
| **Button** | `components/ui/Button.tsx` | Variants: primary/outline/ghost/danger; sizes: sm/md/lg; loading state |
| **Input** | `components/ui/Input.tsx` | Types: email/phone/password/text; labels; placeholders |
| **Card** | `components/ui/Card.tsx` | Container com border, padding, shadow |
| **Badge** | `components/ui/Badge.tsx` | Status display (hardcoded colors?) |
| **Loading** | `components/ui/Loading.tsx` | Spinner + SkeletonCard (para lists) |

**Nota**: Badge.tsx não foi lido, cores status não verificadas.

---

## 14. Gaps Críticos vs Fase 8 do Servidor

### 14.1 Login & Auth

| Feature | Status | Prioridade |
|---------|--------|-----------|
| Login básico | ✅ | - |
| Refresh token | ❌ | 🔴 ALTA |
| 2FA | ❌ | 🟡 MÉDIA |
| Social login | ❌ | 🟡 MÉDIA |
| Tela config servidor (modo cérebro) | ❌ | 🔴 ALTA |

### 14.2 Dashboard & Navegação

| Feature | Status | Prioridade |
|---------|--------|-----------|
| Dashboard cliente | ✅ (básico - só salões) | 🟢 |
| Dashboard profissional | ⚠️ (abas soltas) | 🔴 ALTA |
| Dashboard admin | ❌ | 🔴 ALTA |
| Multi-tenant (salao_id) | ✅ (no store/telas) | 🟢 |

### 14.3 Funcionalidades Core

| Feature | Cliente | Profissional | Admin | Prioridade |
|---------|---------|--------------|-------|-----------|
| **Agenda** | ❌ | ✅ | ❌ | 🔴 |
| **Clientes** | ✅ (salões) | ❌ | ❌ | 🟡 |
| **Vendas/Pedidos** | ✅ (loja) | ❌ | ❌ | 🟡 |
| **Comissões** | ❌ | ✅ (read-only) | ❌ (sem admin UI) | 🔴 |
| **Notificações** | ⚠️ (push token sim, UI não) | ⚠️ | ❌ | 🔴 |
| **Ponto/Time tracking** | ❌ | ✅ | ❌ | 🟢 |

### 14.4 Integrações

| Feature | Status |
|---------|--------|
| WebSocket (eventos) | ✅ (basic) |
| WebSocket (chat) | ✅ (implemented) |
| Push notifications | ⚠️ (sem listener na UI) |
| Deep linking | ❌ |
| Offline mode | ❌ |
| Sync quando online | ❌ |

---

## 15. Arquivos Existentes vs Stubs vs Placeholders

### 15.1 Rotas Completas (REAL)

```
✅ app/(auth)/login.tsx
✅ app/(auth)/register.tsx
✅ app/(cliente)/(tabs)/index.tsx (dashboard salões)
✅ app/(cliente)/(tabs)/pedidos.tsx
✅ app/(cliente)/(tabs)/loja.tsx
✅ app/(cliente)/(tabs)/carrinho.tsx
✅ app/(cliente)/(tabs)/perfil.tsx
✅ app/(profissional)/(tabs)/agenda.tsx
✅ app/(profissional)/(tabs)/ponto.tsx
✅ app/(profissional)/(tabs)/atendimentos.tsx
✅ app/(profissional)/(tabs)/comissoes.tsx
✅ app/(profissional)/(tabs)/produtos-atendimento.tsx
✅ app/(profissional)/(tabs)/chat.tsx
```

### 15.2 Rotas Faltando Implementação

```
⚠️ app/(cliente)/(tabs)/meus-pedidos-loja.tsx
   - Tab existe no _layout mas arquivo não encontrado na auditoria
   - Nome sugere implementação, mas precisa verificar
   
❓ app/(cliente)/salao/[id].tsx
   - Referenciada em index.tsx (router.push)
   - NÃO ENCONTRADA na auditoria
   
❓ app/(cliente)/produto/[id].tsx
   - Referenciada em loja.tsx (router.push)
   - NÃO ENCONTRADA na auditoria
   
❌ app/(profissional)/(tabs)/perfil.tsx
   - Tab em _layout mas arquivo NÃO EXISTE
```

### 15.3 Stubs Confirmados

```
❌ hooks/useNotificacoes.ts
   - Função vazia, não consumida
   
❌ hooks/useWebSocket.ts
   - Mencionado em imports de _layout.tsx?
   - Não encontrado, pode ser removido
```

### 15.4 Componentes Faltando

```
❌ components/ui/Badge.tsx
   - Importado em várias telas
   - Não foi lido (comportamento de status colors desconhecido)
   
❓ Layout para drawer/modal de salão/produto
   - Telas dinâmicas referenciadas mas não implementadas
```

---

## 16. Resumo de Endpoints Consumidos

### Cliente

```
GET   /saloes/publico               (búsca de salões)
GET   /app/pedidos/saloes           (salões para loja)
GET   /app/loja/saloes/{id}/produtos (produtos salão)
GET   /app/pedidos/meus             (meus agendamentos)
POST  /app/loja/pedido              (finalizar compra)
PUT   /app/auth/push-token          (registrar push)
POST  /app/auth/login               (login)
POST  /app/auth/register            (registro)
PUT   /app/auth/perfil              (atualizar perfil)
GET   /app/auth/perfil?             (buscar perfil?)
```

### Profissional

```
POST  /app/profissional/auth/login           (login)
PUT   /app/profissional/auth/push-token      (registrar push)
GET   /app/profissional/agenda               (agenda dia)
GET   /app/profissional/comissoes            (comissões)
POST  /app/profissional/aviso-atraso         (notificar atraso)
GET   /app/profissional/ponto                (resumo ponto)
POST  /app/profissional/ponto                (bater ponto)
GET   /app/profissional/atendimentos-hoje    (agendamentos hoje)
GET   /app/profissional/atendimentos         (histórico)
POST  /app/profissional/atendimentos/{id}/iniciar
POST  /app/profissional/atendimentos/{id}/finalizar
GET   /app/profissional/produtos-utilizados  (histórico)
POST  /app/profissional/produtos-utilizados  (registrar uso)
GET   /app/profissional/chat                 (histórico chat)
POST  /app/profissional/perfil               (update? não observado)
```

### Admin (NÃO HÁ MOBILE)

```
Nenhum endpoint admin consumido
```

---

## 17. Security Analysis

### ✅ Boas Práticas Observadas

1. **Token em SecureStore**: JWT em Keychain/Keystore, não em AsyncStorage
2. **Migração Legacy**: Código que remove tokens antigos de AsyncStorage
3. **Request Timeout**: 10s em todas as requisições
4. **Error Mapping**: Mensagens de erro customizadas para usuário
5. **Input Validation**: Verificação básica antes de submit (email, senha 6+ chars)
6. **Encryption Util**: `encryptedStorage` com AES-256 (não consumido?)

### ⚠️ Pontos de Atenção

1. **Base URL Hardcoded**: IP local sem fallback para prod
2. **Sem Refresh Token**: Logout automático na expiração
3. **WebSocket sem Auth**: URL com query params (`?tipo=...&id=...`) expõe user info
4. **Push Token Silencioso**: Falha não notifica usuário
5. **Chat via WebSocket**: Sem encryption (plain JSON)
6. **encryptedStorage Unused**: Função existe mas não utilizada em nenhuma tela
7. **Carrinho não Persistido**: Perdido ao fechar app
8. **CSRF**: Não observado proteção contra CSRF em forms

---

## 18. Estrutura de Pastas Sugerida para Reescrita

```
softhair-mobile-v2/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (cliente)/
│   │   ├── (profissional)/
│   │   ├── (admin)/                    # NOVA
│   │   └── _layout.tsx
│   ├── features/
│   │   ├── auth/                       # Login, register, refresh
│   │   ├── agenda/                     # Agendamentos (refatorar)
│   │   ├── comissoes/                  # Comissões admin + prof
│   │   ├── chat/                       # Chat (refatorar WebSocket)
│   │   ├── notifications/              # Push + in-app
│   │   └── ponto/                      # Time tracking
│   ├── shared/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── stores/
│   │   └── utils/
│   └── assets/
├── app.json
├── package.json
└── tsconfig.json
```

---

## 19. Checklist para Reescrita

### Phase 1: Foundation
- [ ] Migrar para `baseURL` dinâmica (env vars + tela config)
- [ ] Implementar refresh token flow
- [ ] Adicionar logout automático on 401
- [ ] Tela de configuração de servidor (modo cérebro)

### Phase 2: Core Features
- [ ] Implementar /(profissional)/(tabs)/perfil
- [ ] Completar /(cliente)/salao/[id] e /produto/[id]
- [ ] Adicionar filtros em comissões (admin dashboard)
- [ ] Refatorar chat: WebSocket SSL + encryption

### Phase 3: Admin
- [ ] Nova rota group: /(admin)/ com auth check
- [ ] Dashboard admin: comissões, usuários, vendas
- [ ] Admin: visualizar/gerenciar profissionais
- [ ] Admin: gráficos de comissões

### Phase 4: Polish
- [ ] Persistir carrinho (AsyncStorage + clear on logout)
- [ ] Offline mode com React Query sync
- [ ] Push notification listener UI
- [ ] Deep linking configurado
- [ ] Error boundaries expandidas
- [ ] Sentry/Bugsnag integration

---

## 20. Conclusão

**Status Geral**: 🟡 **Funcional mas Incompleto**

### Forças
- Estrutura Expo Router bem organizada
- Zustand + React Query bem configurados
- SecurityStore correto para tokens
- UI consistente com NativeWind
- Comissões básico implementado

### Fraquezas
- Sem refresh token (bloqueador)
- Admin UI não existe
- Algumas rotas dinâmicas faltando
- Perfil profissional vazio
- Chat sem SSL/encryption
- Notificações não ouvidas na UI

### Próximos Passos
1. Implementar refresh token
2. Criar dashboard admin
3. Completar rotas dinâmicas
4. Adicionar filtros em comissões
5. Refatorar WebSocket para SSL + encryption

---

**Data da Auditoria**: 2026-05-19  
**Auditor**: Claude (Haiku 4.5)  
**Contexto**: Planejamento reescrita mobile v2
