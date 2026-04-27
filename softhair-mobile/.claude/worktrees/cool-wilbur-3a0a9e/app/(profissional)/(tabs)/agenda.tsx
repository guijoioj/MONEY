import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Loading, SkeletonCard } from '../../../components/ui/Loading';

interface Agendamento {
  id: string;
  clienteNome?: string;
  clienteTelefone?: string;
  servicoNome: string;
  dataHora: string;
  status: string;
  observacoes?: string;
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function formatHour(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function AgendaScreen() {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [showAtrasoModal, setShowAtrasoModal] = useState(false);
  const [mensagemAtraso, setMensagemAtraso] = useState('');
  const [loadingAtraso, setLoadingAtraso] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['agenda', selectedDate],
    queryFn: async () => {
      const res = await api.get('/app/profissional/agenda', {
        params: { data: selectedDate },
      });
      return res.data.data as Agendamento[];
    },
  });

  const handleAvisarAtraso = async () => {
    if (!mensagemAtraso.trim()) {
      Alert.alert('Atenção', 'Digite uma mensagem.');
      return;
    }
    setLoadingAtraso(true);
    try {
      await api.post('/app/profissional/aviso-atraso', {
        mensagem: mensagemAtraso.trim(),
      });
      setShowAtrasoModal(false);
      setMensagemAtraso('');
      Alert.alert('Aviso enviado!', 'O salão foi notificado.');
    } catch (err: any) {
      Alert.alert('Erro', err.userMessage ?? 'Não foi possível enviar.');
    } finally {
      setLoadingAtraso(false);
    }
  };

  const navDate = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(formatDate(d));
  };

  const renderItem = ({ item }: { item: Agendamento }) => (
    <Card className="mb-3">
      <View className="flex-row items-start justify-between mb-2">
        <View className="bg-indigo-100 px-3 py-1.5 rounded-lg">
          <Text className="text-secondary font-bold text-sm">
            {formatHour(item.dataHora)}
          </Text>
        </View>
        <Badge status={item.status} />
      </View>
      <Text className="text-text font-semibold">{item.servicoNome}</Text>
      {item.clienteNome && (
        <View className="flex-row items-center mt-1">
          <Ionicons name="person-outline" size={14} color="#6b7280" />
          <Text className="text-muted text-sm ml-1">{item.clienteNome}</Text>
        </View>
      )}
      {item.clienteTelefone && (
        <View className="flex-row items-center mt-0.5">
          <Ionicons name="call-outline" size={14} color="#6b7280" />
          <Text className="text-muted text-sm ml-1">{item.clienteTelefone}</Text>
        </View>
      )}
      {item.observacoes && (
        <Text className="text-muted text-xs mt-2 italic">{item.observacoes}</Text>
      )}
    </Card>
  );

  return (
    <View className="flex-1 bg-pro-bg">
      {/* Header */}
      <View className="bg-secondary pt-14 pb-4 px-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-white text-xl font-bold">Agenda</Text>
          <TouchableOpacity
            onPress={() => setShowAtrasoModal(true)}
            className="bg-white/20 px-3 py-2 rounded-xl flex-row items-center"
          >
            <Ionicons name="warning-outline" size={16} color="white" />
            <Text className="text-white text-xs ml-1 font-semibold">Atraso</Text>
          </TouchableOpacity>
        </View>

        {/* Date Navigator */}
        <View className="flex-row items-center justify-between mt-4">
          <TouchableOpacity onPress={() => navDate(-1)}>
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white font-semibold">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
              weekday: 'long',
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
                <Ionicons name="calendar-outline" size={56} color="#d1d5db" />
                <Text className="text-muted mt-4">Nenhum agendamento para este dia.</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Modal atraso */}
      <Modal visible={showAtrasoModal} transparent animationType="slide">
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
            <Text className="text-text text-lg font-bold mb-2">Avisar atraso</Text>
            <Text className="text-muted text-sm mb-4">
              O salão será notificado imediatamente.
            </Text>
            <TextInput
              className="border border-border rounded-xl px-4 py-3 text-text mb-4"
              placeholder="Ex: Vou me atrasar cerca de 15 minutos..."
              placeholderTextColor="#9ca3af"
              value={mensagemAtraso}
              onChangeText={setMensagemAtraso}
              multiline
              numberOfLines={3}
              style={{ height: 80, textAlignVertical: 'top' }}
            />
            <Button
              label="Enviar aviso"
              onPress={handleAvisarAtraso}
              loading={loadingAtraso}
            />
            <View className="mt-3">
              <Button
                label="Cancelar"
                variant="ghost"
                onPress={() => setShowAtrasoModal(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
