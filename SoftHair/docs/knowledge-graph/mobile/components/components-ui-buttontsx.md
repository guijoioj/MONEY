# components/ui/Button.tsx

**Repository:** Mobile
**File:** `components/ui/Button.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `components/ui/Button.tsx` do repositório Mobile.

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
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
  size = 'md',
}: ButtonProps) {
  const sizeClasses = { sm: 'px-4 py-2', md: 'px-6 py-4', lg: 'px-8 py-5' }[size];

  const variantClasses = {
    primary: 'bg-primary',
    outline: 'border-2 border-primary bg-transparent',
    ghost: 'bg-transparent',
    danger: 'bg-danger',
  }[variant];

  const textClasses = {
    primary: 'text-white font-bold',
    outline: 'text-primary font-bold',
    ghost: 'text-primary font-medium',
    danger: 'text-white font-bold',
  }[variant];

  const textSize = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' }[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={`items-center justify-center rounded-2xl ${sizeClasses} ${variantClasses} ${fullWidth ? 'w-full' : ''} ${isDisabled ? 'opacity-50' : ''}`}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : '#db2777'} />
      ) : (
        <Text className={`${textClasses} ${textSize}`}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
```
