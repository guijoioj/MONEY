import { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { comissoesV2, formatBRL, type Comissao, type ComissaoStatus } from '../../services/comissoes';

function StatusBadge({ status }: { status: ComissaoStatus }) {
  const map: Record<ComissaoStatus, { bg: string; text: string; label: string }> = {
    pendente:  { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'Pendente' },
    paga:      { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Paga' },
    estornada: { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Estornada' },
    cancelada: { bg: 'bg-gray-200',   text: 'text-gray-700',   label: 'Cancelada' },
    bloqueada: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Bloqueada' },
  };
  const s = map[status] || map.pendente;
  return (
    <View className={`px-2 py-0.5 rounded-full ${s.bg}`}>
      <Text className={`text-xs ${s.text} font-medium`}>{s.label}</Text>
    </View>
  );
}

export default function ComissoesAdmin() {
  const [statusFilter, setStatusFilter] = useState<ComissaoStatus | ''>('');
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0, 7));

  const { data: dash } = useQuery({
    queryKey: ['comissoes-admin-dash', competencia],
    queryFn: () => comissoesV2.dashboard({ competencia }),
  });

  const { data: comissoes, refetch, isRefetching, isLoading } = useQuery({
    queryKey: ['comissoes-admin-list', statusFilter, competencia],
    queryFn: () => comissoesV2.list({
      status: statusFilter || undefined,
      competencia,
      limit: 50,
    }),
  });

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ec4899" />}
    >
      <View className="p-4">
        {/* Quick links */}
        <View className="flex-row gap-2 mb-4">
          <Link href={'/(admin)/regras-comissao' as any} asChild>
            <TouchableOpacity className="flex-1 bg-indigo-500 p-3 rounded-lg items-center">
              <Text className="text-white font-semibold">⚙️ Regras</Text>
            </TouchableOpacity>
          </Link>
          <Link href={'/(admin)/pagamento-comissao' as any} asChild>
            <TouchableOpacity className="flex-1 bg-green-500 p-3 rounded-lg items-center">
              <Text className="text-white font-semibold">💰 Pagar</Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Stats */}
        {dash && (
          <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
            <Text className="text-xs uppercase text-gray-500 mb-2">Resumo {competencia}</Text>
            <View className="flex-row justify-between mb-1">
              <Text className="text-amber-700">Pendente</Text>
              <Text className="font-mono font-semibold">{formatBRL(dash.total_pendente_cents)}</Text>
            </View>
            <View className="flex-row justify-between mb-1">
              <Text className="text-green-700">Pago</Text>
              <Text className="font-mono font-semibold">{formatBRL(dash.total_pago_cents)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-red-700">Estornado</Text>
              <Text className="font-mono font-semibold">{formatBRL(dash.total_estornado_cents)}</Text>
            </View>
          </View>
        )}

        {/* Competência */}
        <TextInput
          value={competencia}
          onChangeText={setCompetencia}
          placeholder="AAAA-MM (ex: 2026-05)"
          className="bg-white border border-gray-200 rounded-lg p-3 mb-3 text-base"
          autoCapitalize="none"
        />

        {/* Status filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          {[
            { v: '',          l: 'Todos' },
            { v: 'pendente',  l: 'Pendente' },
            { v: 'paga',      l: 'Paga' },
            { v: 'estornada', l: 'Estornada' },
          ].map(opt => (
            <TouchableOpacity
              key={opt.v || 'all'}
              onPress={() => setStatusFilter(opt.v as ComissaoStatus | '')}
              className={`px-3 py-1.5 rounded-full mr-2 ${statusFilter === opt.v ? 'bg-pink-500' : 'bg-white border border-gray-200'}`}
            >
              <Text className={statusFilter === opt.v ? 'text-white font-medium' : 'text-gray-700'}>{opt.l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Lista */}
        {isLoading ? (
          <ActivityIndicator size="large" color="#ec4899" className="mt-8" />
        ) : !comissoes?.length ? (
          <View className="bg-white p-6 rounded-lg items-center">
            <Text className="text-gray-500">Nenhuma comissão</Text>
          </View>
        ) : (
          comissoes.map((c: Comissao) => (
            <View key={c.id} className="bg-white p-4 rounded-lg mb-2 shadow-sm">
              <View className="flex-row justify-between items-start mb-1">
                <Text className="font-semibold text-gray-900 flex-1" numberOfLines={1}>
                  {c.profissional_nome || `Prof #${c.profissional_id}`}
                </Text>
                <StatusBadge status={c.status} />
              </View>
              <Text className="text-sm text-gray-600 mb-1">
                {c.cliente_nome || '—'} · {c.servico_nome || c.produto_nome || '—'}
              </Text>
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-gray-400">
                  {c.data_geracao ? new Date(c.data_geracao).toLocaleDateString('pt-BR') : '—'}
                </Text>
                <Text className="text-base font-mono font-bold text-gray-900">
                  {formatBRL(c.valor_comissao_cents)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
