# app/(profissional)/_layout.tsx

**Repository:** Mobile
**File:** `app/(profissional)/_layout.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `app/(profissional)/_layout.tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/sync|sync]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]
- [[domains/state|state]]

- [[mobile/entities/mobile-a3efbae8|Mobile]]
- [[mobile/entities/expo-router-f2219e27|expo-router]]
- [[mobile/entities/usewebsocket-1150c4bb|useWebSocket]]

## Arquivos Relacionados

- [[mobile/app/app-cliente-_layouttsx|app/(cliente)/_layout.tsx]]
- [[mobile/app/app-profissional-tabs-_layouttsx|app/(profissional)/(tabs)/_layout.tsx]]
- [[mobile/app/app-_layouttsx|app/_layout.tsx]]
- [[mobile/app/app-indextsx|app/index.tsx]]

## Conteudo

```tsx
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useWebSocket } from '../../hooks/useWebSocket';

function WSConnector() {
  useWebSocket();
  return null;
}

export default function ProfissionalLayout() {
  const { isAuthenticated, userType } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (userType === 'cliente') {
    return <Redirect href="/(cliente)/(tabs)" />;
  }

  return (
    <>
      <WSConnector />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
```
