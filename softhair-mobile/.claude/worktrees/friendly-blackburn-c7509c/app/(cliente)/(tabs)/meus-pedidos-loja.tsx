import React from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { SkeletonCard } from '../../../components/ui/Loading';

interface Item {
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
}

interface PedidoLoja {
  id: string;
  salaoNome: string;
  status: string;
  total: number;
  formaPagamento?: string;
  createdAt: string;
  itens?: Item[];
}

export default function MeusPedidosLojaScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['meus-pedidos-loja'],
    queryFn: async () => {
      const res = await api.get('/app/loja/meus-pedidos');
      return res.data.data as PedidoLoja[];
    },
  });

  const renderItem = ({ item }: { item: PedidoLoja }) => (
    <Card className="mb-3">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-text font-bold" numberOfLines={1}>
            {item.salaoNome}
          </Text>
          <Text className="text-muted text-xs mt-0.5">
            {new Date(item.createdAt).toLocaleDateString('pt-BR')}
          </Text>
        </View>
        <Badge status={item.status} />
      </View>

      {item.itens?.map((i, idx) => (
        <Text key={idx} className="text-muted text-sm">
          {i.quantidade}x {i.produtoNome}
        </Text>
      ))}

      <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-border">
        <Text className="text-muted text-sm">
          {item.formaPagamento ? item.formaPagamento.charAt(0).toUpperCase() + item.formaPagamento.slice(1) : ''}
        </Text>
        <Text className="text-primary font-bold">
          R$ {item.total.toFixed(2)}
        </Text>
      </View>
    </Card>
  );

  return (
    <View className="flex-1 bg-background">
      <View className="bg-secondary pt-14 pb-6 px-6">
        <Text className="text-white text-2xl font-bold">Meus Pedidos</Text>
        <Text className="text-indigo-200 text-sm mt-1">Histórico de compras</Text>
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
                colors={['#6366f1']}
                tintColor="#6366f1"
              />
            }
            ListEmptyComponent={
              <View className="items-center py-16">
                <Ionicons name="receipt-outline" size={56} color="#e5e7eb" />
                <Text className="text-muted mt-4 text-center">
                  Nenhum pedido realizado ainda.
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
