# app/(cliente)/_layout.tsx

**Repository:** Mobile
**File:** `app/(cliente)/_layout.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `app/(cliente)/_layout.tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/produtos|produtos]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]
- [[domains/state|state]]

- [[mobile/entities/clientelayout-534bd93a|ClienteLayout]]
- [[mobile/entities/mobile-a3efbae8|Mobile]]

## Arquivos Relacionados

- [[mobile/app/app-profissional-tabs-_layouttsx|app/(profissional)/(tabs)/_layout.tsx]]
- [[mobile/app/app-profissional-_layouttsx|app/(profissional)/_layout.tsx]]
- [[mobile/app/app-_layouttsx|app/_layout.tsx]]
- [[mobile/app/app-indextsx|app/index.tsx]]

## Conteudo

```tsx
import { Stack } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { Redirect } from 'expo-router';
import { useWebSocket } from '../../hooks/useWebSocket';

function WSConnector() {
  useWebSocket();
  return null;
}

export default function ClienteLayout() {
  const { isAuthenticated, userType } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (userType === 'profissional') {
    return <Redirect href="/(profissional)/(tabs)/agenda" />;
  }

  return (
    <>
      <WSConnector />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="salao/[id]" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="produto/[id]" options={{ headerShown: false, presentation: 'card' }} />
      </Stack>
    </>
  );
}
```
