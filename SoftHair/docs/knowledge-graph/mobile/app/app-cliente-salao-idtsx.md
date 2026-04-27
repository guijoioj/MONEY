# app/(cliente)/salao/[id].tsx

**Repository:** Mobile
**File:** `app/(cliente)/salao/[id].tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `app/(cliente)/salao/[id].tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/produtos|produtos]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```tsx
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Button } from '../../../components/ui/Button';
import { Loading } from '../../../components/ui/Loading';

interface Salao {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  telefone?: string;
  endereco?: string;
  email?: string;
}

export default function SalaoPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: saloes, isLoading } = useQuery({
    queryKey: ['saloes'],
    queryFn: async () => {
      const res = await api.get('/app/pedidos/saloes');
      return res.data.data as Salao[];
    },
  });

  const salao = saloes?.find((s) => s.id === id);

  if (isLoading) return <Loading fullScreen />;

  if (!salao) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-muted">Salão não encontrado.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Hero */}
      <View className="bg-primary pt-14 pb-8 px-6">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View className="w-16 h-16 bg-white/20 rounded-2xl items-center justify-center mb-3">
          <Ionicons name="cut" size={32} color="white" />
        </View>
        <Text className="text-white text-2xl font-bold">{salao.nome}</Text>
        <Text className="text-pink-200 mt-1">
          {salao.cidade}, {salao.estado}
        </Text>
        {salao.telefone && (
          <Text className="text-pink-200 text-sm mt-0.5">{salao.telefone}</Text>
        )}
      </View>

      <ScrollView className="flex-1 px-6 pt-6">
        {salao.endereco && (
          <View className="flex-row items-center mb-4">
            <Ionicons name="location-outline" size={18} color="#6b7280" />
            <Text className="text-muted ml-2 text-sm">{salao.endereco}</Text>
          </View>
        )}
        {salao.email && (
          <View className="flex-row items-center mb-6">
            <Ionicons name="mail-outline" size={18} color="#6b7280" />
            <Text className="text-muted ml-2 text-sm">{salao.email}</Text>
          </View>
        )}

        <View className="gap-3">
          <Button
            label="Solicitar Agendamento"
            onPress={() =>
              router.push({
                pathname: '/(cliente)/(tabs)/agendar',
                params: { salonId: salao.id, salaoNome: salao.nome },
              })
            }
          />
          <Button
            label="Ver Loja de Produtos"
            variant="outline"
            onPress={() =>
              router.push({
                pathname: '/(cliente)/(tabs)/loja',
                params: { salonId: salao.id },
              })
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}
```
