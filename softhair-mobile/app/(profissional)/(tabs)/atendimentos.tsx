import React, { useState } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { SkeletonCard } from '../../../components/ui/Loading';

interface ServicoAtendimento {
  servicoId: string;
  horaInicio?: string;
  horaFim?: string;
  preco: number;
}

interface Atendimento {
  id: string;
  clienteNome?: string;
  data: string;
  horaInicio?: string;
  horaFim?: string;
  totalGeral: number;
  status: string;
  servicos?: ServicoAtendimento[];
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function AtendimentosScreen() {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['atendimentos', selectedDate],
    queryFn: async () => {
      const res = await api.get('/app/profissional/atendimentos', {
        params: { data: selectedDate },
      });
      return res.data.data as Atendimento[];
    },
  });

  const navDate = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(formatDate(d));
  };

  const renderItem = ({ item }: { item: Atendimento }) => (
    <Card className="mb-3">
      <View className="flex-row justify-between items-start mb-2">
        <View>
          <Text className="text-text font-semibold">
            {item.clienteNome ?? 'Cliente não identificado'}
          </Text>
          {item.horaInicio && (
            <Text className="text-muted text-xs mt-0.5">
              {item.horaInicio}{item.horaFim ? ` → ${item.horaFim}` : ''}
            </Text>
          )}
        </View>
        <Badge status={item.status} />
      </View>

      {item.servicos && item.servicos.length > 0 && (
        <View className="border-t border-border pt-2 mt-1">
          {item.servicos.map((s, idx) => (
            <Text key={idx} className="text-muted text-sm">
              R$ {s.preco.toFixed(2)}
            </Text>
          ))}
        </View>
      )}

      <View className="flex-row justify-end mt-2 pt-2 border-t border-border">
        <Text className="text-secondary font-bold">
          Total: R$ {item.totalGeral.toFixed(2)}
        </Text>
      </View>
    </Card>
  );

  return (
    <View className="flex-1 bg-pro-bg">
      <View className="bg-secondary pt-14 pb-4 px-6">
        <Text className="text-white text-xl font-bold">Atendimentos</Text>
        <View className="flex-row items-center justify-between mt-3">
          <TouchableOpacity onPress={() => navDate(-1)}>
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white font-semibold">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
            })}
          </Text>
          <TouchableOpacity onPress={() => navDate(1)}>
            <Ionicons name="chevron-forward" size={24} color="white" />
          </TouchableOpacity>
        </View>
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
                <Ionicons name="clipboard-outline" size={56} color="#d1d5db" />
                <Text className="text-muted mt-4">Nenhum atendimento neste dia.</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
}
