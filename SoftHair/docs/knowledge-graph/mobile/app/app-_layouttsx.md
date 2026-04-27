# app/_layout.tsx

**Repository:** Mobile
**File:** `app/_layout.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `app/_layout.tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]
- [[domains/state|state]]

- [[mobile/entities/errorboundary-32ba2670|ErrorBoundary]]
- [[mobile/entities/loading-3c156a7a|Loading]]
- [[mobile/entities/mobile-a3efbae8|Mobile]]
- [[mobile/entities/rootlayoutnav-ea88db7e|RootLayoutNav]]
- [[mobile/entities/stack-3b4458ee|Stack]]
- [[mobile/entities/authstore-079daee5|authStore]]
- [[mobile/entities/expo-router-f2219e27|expo-router]]
- [[mobile/entities/wsmanager-fda992d7|wsManager]]

## Arquivos Relacionados

- [[mobile/app/app-cliente-_layouttsx|app/(cliente)/_layout.tsx]]
- [[mobile/app/app-profissional-tabs-_layouttsx|app/(profissional)/(tabs)/_layout.tsx]]
- [[mobile/app/app-profissional-_layouttsx|app/(profissional)/_layout.tsx]]
- [[mobile/app/app-indextsx|app/index.tsx]]

## Conteudo

```tsx
import '../global.css';
import React, { useEffect, Component, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ScrollView } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { wsManager } from '../services/websocket';
import { Loading } from '../components/ui/Loading';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#dc2626', marginBottom: 12 }}>
            Erro na inicialização
          </Text>
          <Text style={{ fontSize: 13, color: '#111', marginBottom: 8 }}>{err.message}</Text>
          <Text style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{err.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2,
    },
  },
});

function RootLayoutNav() {
  const { isLoading, isAuthenticated, user, userType, loadFromStorage } =
    useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (userType === 'cliente' && user.clienteAppId) {
        wsManager.connect(user.clienteAppId, 'cliente');
      } else if (userType === 'profissional' && user.profissionalId) {
        wsManager.connect(user.profissionalId, 'profissional');
      }
    } else {
      wsManager.disconnect();
    }
  }, [isAuthenticated, user, userType]);

  if (isLoading) {
    return <Loading fullScreen mensagem="Carregando..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(cliente)" />
      <Stack.Screen name="(profissional)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <RootLayoutNav />
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
```
