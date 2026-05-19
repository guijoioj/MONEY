import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { comissoesV2, formatBRL, type Comissao } from '../../services/comissoes';
import api from '../../services/api';

interface Profissional { id: number; nome: string }

export default function PagamentoComissaoMobile() {
  const router = useRouter();
  const [profissionalId, setProfissionalId] = useState<number | null>(null);
  const [periodoInicio, setPeriodoInicio] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [periodoFim, setPeriodoFim] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [formaPagamento, setFormaPagamento] = useState('pix');

  // Profissionais
  const { data: profs } = useQuery({
    queryKey: ['mobile-profissionais'],
    queryFn: () => api.get('/api/profissionais').then(r => {
      const d = r.data;
      return (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []) as Profissional[];
    }),
  });

  // Comissões pendentes
  const { data: comissoes, isLoading } = useQuery({
    queryKey: ['mobile-pag-pendentes', profissionalId, periodoInicio, periodoFim],
    queryFn: () => comissoesV2.list({
      profissional_id: profissionalId!,
      status: 'pendente',
      data_inicio: periodoInicio,
      data_fim: periodoFim,
      limit: 500,
    }),
    enabled: !!profissionalId,
  });

  const totalSelecionadoCents = (comissoes || [])
    .filter((c: Comissao) => selectedIds.has(c.id))
    .reduce((s: number, c: Comissao) => s + Number(c.valor_comissao_cents || 0), 0);

  const pagar = useMutation({
    mutationFn: () => comissoesV2.pagar({
      profissional_id: profissionalId!,
      data_inicio: periodoInicio,
      data_fim: periodoFim,
      comissoes_ids: Array.from(selectedIds),
      valor_confirmado_cents: totalSelecionadoCents,
      forma_pagamento: formaPagamento,
      idempotency_key: `pag-${profissionalId}-${periodoInicio}-${Date.now()}`,
    }),
    onSuccess: (r) => {
      Alert.alert('Pagamento realizado', `Valor: ${formatBRL(r.valor_total_cents)}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (e: any) => {
      Alert.alert('Erro', e?.response?.data?.error || e.message);
    },
  });

  const toggleAll = () => {
    if (selectedIds.size === comissoes?.length) setSelectedIds(new Set());
    else setSelectedIds(new Set((comissoes || []).map((c: Comissao) => c.id)));
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <Text className="text-lg font-bold mb-3 text-gray-900">1. Profissional</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {(profs || []).map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => { setProfissionalId(p.id); setSelectedIds(new Set()); }}
              className={`px-4 py-2 rounded-full mr-2 ${profissionalId === p.id ? 'bg-pink-500' : 'bg-white border border-gray-200'}`}
            >
              <Text className={profissionalId === p.id ? 'text-white font-medium' : 'text-gray-700'}>{p.nome}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text className="text-lg font-bold mb-3 text-gray-900">2. Período</Text>
        <View className="flex-row gap-2 mb-4">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1">De</Text>
            <TextInput
              value={periodoInicio}
              onChangeText={setPeriodoInicio}
              className="bg-white border border-gray-200 rounded p-2 font-mono"
              autoCapitalize="none"
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1">Até</Text>
            <TextInput
              value={periodoFim}
              onChangeText={setPeriodoFim}
              className="bg-white border border-gray-200 rounded p-2 font-mono"
              autoCapitalize="none"
            />
          </View>
        </View>

        {profissionalId && (
          <>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-lg font-bold text-gray-900">
                3. Comissões ({comissoes?.length || 0})
              </Text>
              <TouchableOpacity onPress={toggleAll}>
                <Text className="text-indigo-600 font-medium">
                  {selectedIds.size === comissoes?.length ? 'Desmarcar' : 'Todas'}
                </Text>
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <ActivityIndicator />
            ) : !comissoes?.length ? (
              <View className="bg-white p-6 rounded-lg items-center mb-4">
                <Text className="text-gray-500">Nenhuma pendente no período</Text>
              </View>
            ) : (
              comissoes.map((c: Comissao) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => {
                    const next = new Set(selectedIds);
                    if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                    setSelectedIds(next);
                  }}
                  className={`bg-white p-3 rounded-lg mb-2 shadow-sm border-2 ${selectedIds.has(c.id) ? 'border-pink-500' : 'border-transparent'}`}
                >
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-900" numberOfLines={1}>
                        {c.cliente_nome || '—'} · {c.servico_nome || c.produto_nome || '—'}
                      </Text>
                      <Text className="text-xs text-gray-500">
                        {c.data_geracao ? new Date(c.data_geracao).toLocaleDateString('pt-BR') : '—'}
                      </Text>
                    </View>
                    <Text className="font-mono font-bold text-gray-900">
                      {formatBRL(c.valor_comissao_cents)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            {selectedIds.size > 0 && (
              <View className="bg-white rounded-lg p-4 mt-3 shadow-sm">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="text-base font-bold">Total selecionado:</Text>
                  <Text className="text-xl font-mono font-bold text-pink-600">
                    {formatBRL(totalSelecionadoCents)}
                  </Text>
                </View>

                <Text className="text-xs text-gray-500 mb-1">Forma de pagamento</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                  {['pix', 'transferencia', 'dinheiro', 'cheque'].map(fp => (
                    <TouchableOpacity
                      key={fp}
                      onPress={() => setFormaPagamento(fp)}
                      className={`px-3 py-1.5 rounded-full mr-2 ${formaPagamento === fp ? 'bg-green-500' : 'bg-gray-100'}`}
                    >
                      <Text className={formaPagamento === fp ? 'text-white' : 'text-gray-700'}>{fp}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  onPress={() => pagar.mutate()}
                  disabled={pagar.isPending}
                  className="bg-green-500 disabled:bg-gray-300 rounded-lg p-4 items-center"
                >
                  {pagar.isPending ? <ActivityIndicator color="white" /> : (
                    <Text className="text-white font-bold">Confirmar Pagamento</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
