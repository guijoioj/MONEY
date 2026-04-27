import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Card } from '../../../components/ui/Card';
import { Loading, SkeletonCard } from '../../../components/ui/Loading';
import { useCarrinhoStore } from '../../../store/carrinhoStore';

interface Produto {
  id: string;
  nome: string;
  descricao?: string;
  marca?: string;
  categoria?: string;
  precoVenda: number;
  estoque: number;
  salonId: string;
}

interface Salao {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
}

export default function LojaScreen() {
  const params = useLocalSearchParams<{ salonId?: string }>();
  const router = useRouter();
  const [selectedSalonId, setSelectedSalonId] = useState(params.salonId ?? '');
  const { addItem } = useCarrinhoStore();

  const { data: saloes } = useQuery({
    queryKey: ['saloes'],
    queryFn: async () => {
      const res = await api.get('/app/pedidos/saloes');
      return res.data.data as Salao[];
    },
  });

  const { data: produtos, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['produtos', selectedSalonId],
    queryFn: async () => {
      const res = await api.get(
        `/app/loja/saloes/${selectedSalonId}/produtos`,
      );
      return res.data.data as Produto[];
    },
    enabled: !!selectedSalonId,
  });

  const salaoSelecionado = saloes?.find((s) => s.id === selectedSalonId);

  const handleAddToCart = (produto: Produto) => {
    if (produto.estoque <= 0) {
      Alert.alert('Sem estoque', 'Este produto está sem estoque.');
      return;
    }
    addItem({
      produtoId: produto.id,
      nome: produto.nome,
      preco: produto.precoVenda,
      quantidade: 1,
      salonId: produto.salonId,
      salaoNome: salaoSelecionado?.nome ?? 'Salão',
    });
    Alert.alert('Adicionado!', `${produto.nome} foi adicionado ao carrinho.`);
  };

  const renderProduto = ({ item }: { item: Produto }) => (
    <TouchableOpacity
      className="mb-3"
      activeOpacity={0.85}
      onPress={() => router.push({
        pathname: '/(cliente)/produto/[id]',
        params: { id: item.id, salonId: item.salonId, salaoNome: salaoSelecionado?.nome ?? '' },
      })}
    >
      <Card>
        <View className="flex-row">
          <View className="w-14 h-14 bg-purple-100 rounded-xl items-center justify-center mr-3">
            <Ionicons name="bag-outline" size={24} color="#6366f1" />
          </View>
          <View className="flex-1">
            <Text className="text-text font-semibold text-sm" numberOfLines={2}>
              {item.nome}
            </Text>
            {item.marca && (
              <Text className="text-muted text-xs">{item.marca}</Text>
            )}
            {item.categoria && (
              <Text className="text-xs text-secondary uppercase font-medium mt-0.5">
                {item.categoria}
              </Text>
            )}
            <View className="flex-row justify-between items-center mt-2">
              <Text className="text-primary font-bold text-base">
                R$ {item.precoVenda.toFixed(2)}
              </Text>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); handleAddToCart(item); }}
                className={`px-3 py-1.5 rounded-lg ${item.estoque > 0 ? 'bg-primary' : 'bg-gray-300'}`}
              >
                <Text className="text-white text-xs font-bold">
                  {item.estoque > 0 ? '+ Carrinho' : 'Esgotado'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#d1d5db" style={{ alignSelf: 'center', marginLeft: 4 }} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background">
      <View className="bg-secondary pt-14 pb-6 px-6">
        <Text className="text-white text-2xl font-bold">Loja</Text>
        <Text className="text-indigo-200 text-sm mt-1">
          Produtos dos salões parceiros
        </Text>
      </View>

      {/* Selector de salão */}
      <View className="px-4 pt-4">
        <Text className="text-text font-semibold text-sm mb-2">Selecione o salão</Text>
        <FlatList
          horizontal
          data={saloes}
          keyExtractor={(s) => s.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedSalonId(item.id)}
              className={`mr-2 px-4 py-2 rounded-xl border-2 ${
                selectedSalonId === item.id
                  ? 'border-secondary bg-indigo-50'
                  : 'border-border bg-white'
              }`}
            >
              <Text
                className={`font-semibold text-sm ${
                  selectedSalonId === item.id ? 'text-secondary' : 'text-text'
                }`}
              >
                {item.nome}
              </Text>
            </TouchableOpacity>
          )}
          className="mb-4"
        />
      </View>

      <View className="flex-1 px-4">
        {!selectedSalonId ? (
          <View className="items-center py-16">
            <Ionicons name="storefront-outline" size={56} color="#e5e7eb" />
            <Text className="text-muted mt-4 text-center">
              Selecione um salão para ver os produtos.
            </Text>
          </View>
        ) : isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <FlatList
            data={produtos}
            keyExtractor={(p) => p.id}
            renderItem={renderProduto}
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
                <Ionicons name="bag-outline" size={56} color="#e5e7eb" />
                <Text className="text-muted mt-4">Nenhum produto disponível.</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}
