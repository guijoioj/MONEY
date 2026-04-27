# components/ui/Loading.tsx

**Repository:** Mobile
**File:** `components/ui/Loading.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `components/ui/Loading.tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/database|database]]
- [[domains/mobile-ui|mobile-ui]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```tsx
import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingProps {
  mensagem?: string;
  fullScreen?: boolean;
}

export function Loading({ mensagem, fullScreen = false }: LoadingProps) {
  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#db2777" />
        {mensagem && (
          <Text className="mt-3 text-muted text-sm">{mensagem}</Text>
        )}
      </View>
    );
  }

  return (
    <View className="py-10 items-center justify-center">
      <ActivityIndicator size="large" color="#db2777" />
      {mensagem && (
        <Text className="mt-3 text-muted text-sm">{mensagem}</Text>
      )}
    </View>
  );
}

export function SkeletonCard() {
  return (
    <View className="bg-surface rounded-2xl p-4 mb-3 border border-border">
      <View className="bg-gray-200 h-5 rounded-lg w-3/4 mb-2" />
      <View className="bg-gray-100 h-4 rounded-lg w-1/2 mb-1" />
      <View className="bg-gray-100 h-4 rounded-lg w-2/3" />
    </View>
  );
}
```
