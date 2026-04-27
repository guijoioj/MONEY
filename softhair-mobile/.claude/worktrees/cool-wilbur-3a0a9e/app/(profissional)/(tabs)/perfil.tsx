import React from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Button } from '../../../components/ui/Button';
import { Loading } from '../../../components/ui/Loading';
import { useAuth } from '../../../hooks/useAuth';

interface Perfil {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  especialidade?: string;
  comissao?: number;
}

export default function PerfilProfissionalScreen() {
  const { logout, user } = useAuth();

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['perfil-profissional'],
    queryFn: async () => {
      const res = await api.get('/app/profissional/perfil');
      return res.data as Perfil;
    },
  });

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  };

  const nome = perfil?.nome ?? user?.nome ?? '';

  return (
    <View className="flex-1 bg-pro-bg">
      <View className="bg-secondary pt-14 pb-8 px-6 items-center">
        <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-3">
          <Ionicons name="person" size={36} color="white" />
        </View>
        <Text className="text-white text-xl font-bold">{nome}</Text>
        {perfil?.especialidade && (
          <Text className="text-indigo-200 text-sm mt-1">{perfil.especialidade}</Text>
        )}
      </View>

      <ScrollView className="flex-1 px-6 pt-6">
        {isLoading ? (
          <Loading />
        ) : (
          <>
            <View className="bg-white rounded-2xl border border-border p-4 mb-6">
              {perfil?.email && (
                <InfoRow icon="mail-outline" label="E-mail" value={perfil.email} />
              )}
              {perfil?.telefone && (
                <InfoRow icon="call-outline" label="Telefone" value={perfil.telefone} />
              )}
              {perfil?.especialidade && (
                <InfoRow
                  icon="cut-outline"
                  label="Especialidade"
                  value={perfil.especialidade}
                />
              )}
              {perfil?.comissao != null && (
                <InfoRow
                  icon="cash-outline"
                  label="Taxa de comissão"
                  value={`${perfil.comissao}%`}
                />
              )}
            </View>

            <Button label="Sair" variant="danger" onPress={handleLogout} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center py-3 border-b border-border last:border-0">
      <Ionicons name={icon} size={18} color="#6b7280" />
      <View className="ml-3">
        <Text className="text-xs text-muted uppercase font-medium">{label}</Text>
        <Text className="text-text text-sm mt-0.5">{value}</Text>
      </View>
    </View>
  );
}
