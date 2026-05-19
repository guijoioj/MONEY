import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { regras, type Regra } from '../../services/comissoes';

const TIPO_LABELS: Record<string, string> = {
  global: 'Global',
  profissional: 'Por profissional',
  servico: 'Por serviço',
  produto: 'Por produto',
  categoria_servico: 'Categoria serviço',
  categoria_produto: 'Categoria produto',
  profissional_servico: 'Prof + serviço',
  profissional_produto: 'Prof + produto',
  assistente: 'Assistente',
  meta: 'Meta',
  dia_semana: 'Dia semana',
  horario: 'Horário',
};

export default function RegrasComissaoMobile() {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mobile-regras-comissao'],
    queryFn: () => regras.list({ ativo: 'true' }),
  });

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ec4899" />}
    >
      <View className="p-4">
        <Text className="text-xs text-gray-500 mb-4">
          Edição completa de regras está disponível no app desktop. Aqui você visualiza as ativas.
        </Text>

        {isLoading ? (
          <ActivityIndicator size="large" color="#ec4899" />
        ) : !data?.length ? (
          <View className="bg-white p-6 rounded-lg items-center">
            <Text className="text-gray-500">Nenhuma regra ativa</Text>
          </View>
        ) : (
          data.map((r: Regra) => (
            <View key={r.id} className="bg-white p-4 rounded-lg mb-2 shadow-sm">
              <View className="flex-row justify-between items-center mb-1">
                <Text className="font-semibold text-gray-900 flex-1">{r.nome}</Text>
                {r.ativo ? (
                  <View className="bg-green-100 px-2 py-0.5 rounded-full">
                    <Text className="text-xs text-green-700">Ativa</Text>
                  </View>
                ) : (
                  <View className="bg-gray-200 px-2 py-0.5 rounded-full">
                    <Text className="text-xs text-gray-700">Inativa</Text>
                  </View>
                )}
              </View>
              <Text className="text-sm text-gray-600 mb-2">{TIPO_LABELS[r.tipo] || r.tipo}</Text>
              <View className="flex-row justify-between">
                <Text className="text-xs text-gray-500">{r.base_calculo}</Text>
                <Text className="font-mono font-bold text-pink-600">
                  {r.valor_fixo_cents
                    ? `R$ ${(r.valor_fixo_cents / 100).toFixed(2)} fixo`
                    : r.percentual != null ? `${Number(r.percentual).toFixed(2)}%` : '—'}
                </Text>
              </View>
              <Text className="text-xs text-gray-400 mt-1">
                {r.data_inicio} {r.data_fim ? `→ ${r.data_fim}` : '→ ∞'}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
