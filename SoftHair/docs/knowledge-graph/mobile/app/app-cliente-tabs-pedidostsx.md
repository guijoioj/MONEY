# app/(cliente)/(tabs)/pedidos.tsx

**Repository:** Mobile
**File:** `app/(cliente)/(tabs)/pedidos.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `app/(cliente)/(tabs)/pedidos.tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/servicos|servicos]]
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
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Loading, SkeletonCard } from '../../../components/ui/Loading';

interface PedidoAgendamento {
  id: string;
  salaoNome: string;
  servicoNome: string;
  profissionalNome?: string;
  dataDesejada: string;
  horarioDesejado: string;
  status: string;
  motivoRejeicao?: string;
  createdAt: string;
}

export default function PedidosScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['meus-pedidos'],
    queryFn: async () => {
      const res = await api.get('/app/pedidos/meus');
      return res.data.data as PedidoAgendamento[];
    },
  });

  const renderItem = ({ item }: { item: PedidoAgendamento }) => (
    <Card className="mb-3">
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-text font-bold text-base flex-1 mr-2" numberOfLines={1}>
          {item.servicoNome}
        </Text>
        <Badge status={item.status} />
      </View>
      <Text className="text-muted text-sm">{item.salaoNome}</Text>
      {item.profissionalNome && (
        <Text className="text-muted text-sm">Com {item.profissionalNome}</Text>
      )}
      <View className="flex-row items-center mt-2">
        <Ionicons name="calendar-outline" size={14} color="#6b7280" />
        <Text className="text-muted text-xs ml-1">
          {item.dataDesejada} às {item.horarioDesejado}
        </Text>
      </View>
      {item.motivoRejeicao && (
        <View className="mt-2 bg-red-50 rounded-lg px-3 py-2">
          <Text className="text-danger text-xs">
            Motivo: {item.motivoRejeicao}
          </Text>
        </View>
      )}
    </Card>
  );

  return (
    <View className="flex-1 bg-background">
      <View className="bg-primary pt-14 pb-6 px-6">
        <Text className="text-white text-2xl font-bold">Agendamentos</Text>
        <Text className="text-pink-200 text-sm mt-1">Seus pedidos de agendamento</Text>
      </View>

      <View className="flex-1 px-4 pt-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(i) => i.id}
            renderItem={renderItem}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                colors={['#db2777']}
                tintColor="#db2777"
              />
            }
            ListEmptyComponent={
              <View className="items-center py-16">
                <Ionicons name="calendar-outline" size={56} color="#e5e7eb" />
                <Text className="text-muted mt-4 text-center">
                  Nenhum agendamento ainda.{'\n'}Encontre um salão e agende!
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}
```
