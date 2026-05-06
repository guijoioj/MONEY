import { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { useAuthStore } from '../../../store/authStore';

export default function ProdutosAtendimento() {
  const { salaoId } = useAuthStore();
  const [search, setSearch] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const queryClient = useQueryClient();

  const { data: produtosData } = useQuery({
    queryKey: ['produtos-salao', salaoId, search],
    queryFn: () =>
      api.get(`/app/loja/saloes/${salaoId}/produtos`, { params: { search } }),
    enabled: !!salaoId,
  });

  const produtos = produtosData?.data?.data || [];

  const registrarMutation = useMutation({
    mutationFn: (produto: { id: number; nome: string; marca?: string }) =>
      api.post('/app/profissional/produtos-utilizados', {
        produto_id: produto.id,
        marca: produto.marca || produto.nome,
        quantidade: parseFloat(quantidade) || 1,
      }),
    onSuccess: () => {
      Alert.alert('Sucesso', 'Produto registrado! Estoque atualizado.');
      queryClient.invalidateQueries({ queryKey: ['produtos-salao'] });
    },
    onError: (err: any) =>
      Alert.alert('Erro', err.response?.data?.error || 'Falha ao registrar produto'),
  });

  return (
    <View className="flex-1 bg-gray-50 p-4">
      <Text className="text-xl font-bold text-gray-800 mb-4">Produtos Utilizados</Text>

      <TextInput
        className="bg-white border border-gray-300 rounded-lg px-4 py-3 mb-3"
        placeholder="Buscar produto..."
        value={search}
        onChangeText={setSearch}
      />

      <View className="flex-row items-center mb-4 gap-2">
        <Text className="text-gray-600 mr-2">Quantidade:</Text>
        <TextInput
          className="bg-white border border-gray-300 rounded-lg px-3 py-2 w-20 text-center"
          value={quantidade}
          onChangeText={setQuantidade}
          keyboardType="numeric"
        />
      </View>

      <FlatList
        data={produtos}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => registrarMutation.mutate(item)}
            disabled={registrarMutation.isPending}
            className="bg-white rounded-lg p-4 mb-2 flex-row justify-between items-center shadow-sm"
          >
            <View className="flex-1">
              <Text className="font-semibold text-gray-800">{item.nome}</Text>
              <Text className="text-sm text-gray-500">
                Estoque: {item.quantidade_estoque ?? item.quantidadeEstoque ?? '?'}
              </Text>
            </View>
            <View className="bg-indigo-600 rounded-lg px-3 py-2">
              <Text className="text-white text-sm font-medium">Usar</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text className="text-center text-gray-400 py-8">Nenhum produto encontrado</Text>
        }
      />
    </View>
  );
}
