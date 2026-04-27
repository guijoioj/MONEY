# components/ui/Badge.tsx

**Repository:** Mobile
**File:** `components/ui/Badge.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `components/ui/Badge.tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/mobile-ui|mobile-ui]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```tsx
import React from 'react';
import { View, Text } from 'react-native';

type BadgeVariant = 'pendente' | 'aprovado' | 'rejeitado' | 'confirmado' | 'preparando' | 'enviado' | 'entregue' | 'cancelado' | 'agendado' | 'default';

const variantMap: Record<BadgeVariant, { bg: string; text: string; label: string }> = {
  pendente:    { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendente' },
  aprovado:    { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Aprovado' },
  rejeitado:   { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Rejeitado' },
  confirmado:  { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'Confirmado' },
  preparando:  { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Preparando' },
  enviado:     { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Enviado' },
  entregue:    { bg: 'bg-green-100',  text: 'text-green-800',  label: 'Entregue' },
  cancelado:   { bg: 'bg-red-100',    text: 'text-red-800',    label: 'Cancelado' },
  agendado:    { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'Agendado' },
  default:     { bg: 'bg-gray-100',   text: 'text-gray-700',   label: '' },
};

interface BadgeProps {
  status: string;
  customLabel?: string;
}

export function Badge({ status, customLabel }: BadgeProps) {
  const variant = (variantMap[status as BadgeVariant] ?? variantMap.default);
  const label = customLabel ?? variant.label ?? status;

  return (
    <View className={`px-3 py-1 rounded-full ${variant.bg} self-start`}>
      <Text className={`text-xs font-bold uppercase ${variant.text}`}>{label}</Text>
    </View>
  );
}
```
