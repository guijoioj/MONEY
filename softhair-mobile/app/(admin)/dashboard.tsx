import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { mobileApi, formatBRL } from '../../services/comissoes';

function Card({ label, value, color, link }: { label: string; value: string; color: string; link?: string }) {
  const Body = (
    <View className="bg-white rounded-lg p-4 shadow-sm border-l-4" style={{ borderLeftColor: color }}>
      <Text className="text-xs text-gray-500 uppercase tracking-wide">{label}</Text>
      <Text className="text-xl font-bold mt-1 text-gray-900">{value}</Text>
    </View>
  );
  return link ? <Link href={link as any}>{Body}</Link> : Body;
}

export default function DashboardAdmin() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mobile-dashboard'],
    queryFn: mobileApi.dashboard,
    retry: 1,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#ec4899" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ec4899" />}
    >
      <View className="p-4 gap-3">
        <Text className="text-2xl font-bold mb-2 text-gray-900">Hoje no salão</Text>

        {data?.role === 'admin' ? (
          <>
            <Card label="Faturamento hoje" value={`R$ ${Number(data.faturamento_hoje || 0).toFixed(2)}`} color="#10b981" />
            <Card label="Agendamentos hoje" value={String(data.agendamentos_hoje || 0)} color="#3b82f6" />
            <Card label="Vendas hoje" value={String(data.vendas_hoje || 0)} color="#8b5cf6" />
            <Card label="Comissões pendentes" value={formatBRL(data.comissoes_pendentes_cents)} color="#f59e0b" link="/(admin)/comissoes" />
          </>
        ) : data?.role === 'profissional' ? (
          <>
            <Card label="Atendimentos hoje" value={String(data.atendimentos_hoje || 0)} color="#3b82f6" />
            <Card label="Comissão pendente mês" value={formatBRL(data.comissao_pendente_mes_cents)} color="#f59e0b" />
            <Card label="Comissão paga mês" value={formatBRL(data.comissao_paga_mes_cents)} color="#10b981" />
          </>
        ) : (
          <View className="bg-yellow-50 p-4 rounded-lg">
            <Text className="text-yellow-800">Role desconhecida. Faça login novamente.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
