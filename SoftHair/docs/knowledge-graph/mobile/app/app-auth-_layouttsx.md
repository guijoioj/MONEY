# app/(auth)/_layout.tsx

**Repository:** Mobile
**File:** `app/(auth)/_layout.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `app/(auth)/_layout.tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]
- [[domains/state|state]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```tsx
import { Stack } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { Redirect } from 'expo-router';

export default function AuthLayout() {
  const { isAuthenticated, userType } = useAuthStore();

  if (isAuthenticated) {
    if (userType === 'profissional') {
      return <Redirect href="/(profissional)/(tabs)/agenda" />;
    }
    return <Redirect href="/(cliente)/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
```
