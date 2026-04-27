import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Loading, SkeletonCard } from '../../../components/ui/Loading';
import { Card } from '../../../components/ui/Card';

interface Salao {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  telefone?: string;
  foto?: string;
}

function SalaoCard({ salao }: { salao: Salao }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push(`/(cliente)/salao/${salao.id}`)}
      className="mb-3"
    >
      <Card>
        <View className="flex-row items-center">
          <View className="w-14 h-14 bg-pink-100 rounded-xl items-center justify-center mr-4">
            <Ionicons name="cut" size={28} color="#db2777" />
          </View>
          <View className="flex-1">
            <Text className="text-text font-bold text-base" numberOfLines={1}>
              {salao.nome}
            </Text>
            <Text className="text-muted text-sm mt-0.5">
              {salao.cidade}, {salao.estado}
            </Text>
            {salao.telefone && (
              <Text className="text-muted text-xs mt-0.5">{salao.telefone}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function SaloesScreen() {
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ['saloes', search],
    queryFn: async () => {
      const res = await api.get('/app/pedidos/saloes', {
        params: search ? { search } : undefined,
      });
      return res.data.data as Salao[];
    },
  });

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-primary pt-14 pb-6 px-6">
        <Text className="text-white text-2xl font-bold">SoftHair</Text>
        <Text className="text-pink-200 text-sm mt-1">Encontre seu salão favorito</Text>
        <View className="flex-row items-center bg-white rounded-xl mt-4 px-4 py-3">
          <Ionicons name="search" size={18} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-text text-sm"
            placeholder="Buscar salão..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      <View className="flex-1 px-4 pt-4">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <View className="items-center py-10">
            <Ionicons name="wifi-outline" size={48} color="#9ca3af" />
            <Text className="text-muted mt-3 text-center">
              Sem conexão com o servidor.{'\n'}Verifique o IP do backend.
            </Text>
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <SalaoCard salao={item} />}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                colors={['#db2777']}
                tintColor="#db2777"
              />
            }
            ListEmptyComponent={
              <View className="items-center py-10">
                <Ionicons name="storefront-outline" size={48} color="#9ca3af" />
                <Text className="text-muted mt-3">Nenhum salão encontrado.</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}
