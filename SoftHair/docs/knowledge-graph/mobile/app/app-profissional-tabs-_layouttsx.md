# app/(profissional)/(tabs)/_layout.tsx

**Repository:** Mobile
**File:** `app/(profissional)/(tabs)/_layout.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `app/(profissional)/(tabs)/_layout.tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/profissionais|profissionais]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]

- [[mobile/entities/ionicons-11991975|Ionicons]]
- [[mobile/entities/mobile-a3efbae8|Mobile]]
- [[mobile/entities/expo-router-f2219e27|expo-router]]

## Arquivos Relacionados

- [[mobile/app/app-cliente-_layouttsx|app/(cliente)/_layout.tsx]]
- [[mobile/app/app-profissional-_layouttsx|app/(profissional)/_layout.tsx]]
- [[mobile/app/app-_layouttsx|app/_layout.tsx]]
- [[mobile/app/app-indextsx|app/index.tsx]]

## Conteudo

```tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfissionalTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e5e7eb',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ponto"
        options={{
          title: 'Ponto',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="atendimentos"
        options={{
          title: 'Atendimentos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="comissoes"
        options={{
          title: 'Comissões',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cash" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```
