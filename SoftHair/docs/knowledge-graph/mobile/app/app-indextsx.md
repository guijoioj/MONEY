# app/index.tsx

**Repository:** Mobile
**File:** `app/index.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `app/index.tsx` do repositório Mobile.

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

- [[mobile/entities/mobile-a3efbae8|Mobile]]
- [[mobile/entities/redirect-ce3a5088|Redirect]]
- [[mobile/entities/authstore-079daee5|authStore]]
- [[mobile/entities/expo-router-f2219e27|expo-router]]

## Arquivos Relacionados

- [[mobile/app/app-cliente-_layouttsx|app/(cliente)/_layout.tsx]]
- [[mobile/app/app-profissional-tabs-_layouttsx|app/(profissional)/(tabs)/_layout.tsx]]
- [[mobile/app/app-profissional-_layouttsx|app/(profissional)/_layout.tsx]]
- [[mobile/app/app-_layouttsx|app/_layout.tsx]]

## Conteudo

```tsx
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const { isAuthenticated, userType } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (userType === 'profissional') {
    return <Redirect href="/(profissional)/(tabs)/agenda" />;
  }

  return <Redirect href="/(cliente)/(tabs)" />;
}
```
