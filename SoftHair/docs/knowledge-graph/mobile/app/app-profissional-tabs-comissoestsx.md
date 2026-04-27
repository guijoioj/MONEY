# app/(profissional)/(tabs)/comissoes.tsx

**Repository:** Mobile
**File:** `app/(profissional)/(tabs)/comissoes.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `app/(profissional)/(tabs)/comissoes.tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/profissionais|profissionais]]
- [[domains/vendas|vendas]]
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
import { SkeletonCard } from '../../../components/ui/Loading';

interface Comissao {
  id: string;
  valor: number;
  dataPagamento: string;
  observacoes?: string;
}

interface ComissoesResponse {
  data: Comissao[];
  totalPago: number;
}

export default function ComissoesScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['comissoes'],
    queryFn: async () => {
      const res = await api.get('/app/profissional/comissoes');
      return res.data as ComissoesResponse;
    },
  });

  return (
    <View className="flex-1 bg-pro-bg">
      <View className="bg-secondary pt-14 pb-6 px-6">
        <Text className="text-white text-xl font-bold">Comissões</Text>
        {data?.totalPago != null && (
          <View className="mt-3 bg-white/20 rounded-xl px-4 py-3">
            <Text className="text-indigo-200 text-xs uppercase font-semibold">
              Total recebido
            </Text>
            <Text className="text-white text-2xl font-bold mt-1">
              R$ {data.totalPago.toFixed(2)}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-1 px-4 pt-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <FlatList
            data={data?.data}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <Card className="mb-3">
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-text font-bold text-base">
                      R$ {item.valor.toFixed(2)}
                    </Text>
                    <Text className="text-muted text-sm mt-0.5">
                      {new Date(item.dataPagamento + 'T12:00:00').toLocaleDateString(
                        'pt-BR',
                      )}
                    </Text>
                    {item.observacoes && (
                      <Text className="text-muted text-xs mt-1 italic">
                        {item.observacoes}
                      </Text>
                    )}
                  </View>
                  <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center">
                    <Ionicons name="cash-outline" size={20} color="#22c55e" />
                  </View>
                </View>
              </Card>
            )}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                colors={['#6366f1']}
                tintColor="#6366f1"
              />
            }
            ListEmptyComponent={
              <View className="items-center py-16">
                <Ionicons name="cash-outline" size={56} color="#d1d5db" />
                <Text className="text-muted mt-4">Nenhuma comissão registrada.</Text>
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
