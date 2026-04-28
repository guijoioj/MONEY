import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Loading } from '../../../components/ui/Loading';

interface RegistroPonto {
  id: string;
  tipo: string;
  timestamp: string;
}

interface ResumoPonto {
  registros: RegistroPonto[];
  entrada?: RegistroPonto;
  saida?: RegistroPonto;
  horasTrabalhadas?: string;
}

interface Agendamento {
  id: number;
  cliente_nome?: string;
  cliente_telefone?: string;
  servico_nome?: string;
  hora_agendamento?: string;
  status: string;
}

interface ProdutoUtilizado {
  id: number;
  marca: string;
  coloracao?: string;
  quantidade: number;
  cliente_nome?: string;
  agendamento_id?: number;
  created_at: string;
}

const tipoLabel: Record<string, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  inicio_atendimento: 'Início do atendimento',
  fim_atendimento: 'Fim do atendimento',
  pausa: 'Pausa',
  retorno_pausa: 'Retorno da pausa',
};

const tipoIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  entrada: 'log-in-outline',
  saida: 'log-out-outline',
  inicio_atendimento: 'play-circle-outline',
  fim_atendimento: 'checkmark-circle-outline',
  pausa: 'pause-circle-outline',
  retorno_pausa: 'play-outline',
};

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function PontoScreen() {
  const [loadingTipo, setLoadingTipo] = useState<string | null>(null);
  const [modalProduto, setModalProduto] = useState(false);
  const [modalAtendimento, setModalAtendimento] = useState(false);
  const [atendimentoAtivo, setAtendimentoAtivo] = useState<Agendamento | null>(null);
  const [marca, setMarca] = useState('');
  const [coloracao, setColoracao] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ponto-hoje'],
    queryFn: async () => {
      const res = await api.get('/app/profissional/ponto');
      const registros = (res.data.data || []).map((r: any) => ({
        id: String(r.id),
        tipo: r.tipo,
        timestamp: r.created_at,
      }));
      const entrada = [...registros].reverse().find((r: RegistroPonto) => r.tipo === 'entrada');
      const ultimoRegistro = registros[registros.length - 1];
      const saida = ultimoRegistro?.tipo === 'saida' ? ultimoRegistro : undefined;
      let horasTrabalhadas = '0:00';
      if (entrada && saida) {
        const diff = new Date(saida.timestamp).getTime() - new Date(entrada.timestamp).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        horasTrabalhadas = `${h}:${String(m).padStart(2, '0')}`;
      }
      return { registros, entrada, saida, horasTrabalhadas } as ResumoPonto;
    },
  });

  const { data: agendamentosHoje } = useQuery({
    queryKey: ['atendimentos-hoje'],
    queryFn: async () => {
      const res = await api.get('/app/profissional/atendimentos-hoje');
      return (res.data.data || []) as Agendamento[];
    },
  });

  const { data: produtos, refetch: refetchProdutos } = useQuery({
    queryKey: ['produtos-utilizados'],
    queryFn: async () => {
      const res = await api.get('/app/profissional/produtos-utilizados');
      return (res.data.data || []) as ProdutoUtilizado[];
    },
  });

  const iniciarAtendimentoMutation = useMutation({
    mutationFn: async (agendamento: Agendamento) => {
      await api.post(`/app/profissional/atendimentos/${agendamento.id}/iniciar`, {});
      return agendamento;
    },
    onSuccess: (agendamento) => {
      setAtendimentoAtivo(agendamento);
      setModalAtendimento(false);
      queryClient.invalidateQueries({ queryKey: ['ponto-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['atendimentos-hoje'] });
    },
    onError: (err: any) => {
      Alert.alert('Erro', err.userMessage ?? 'Não foi possível iniciar o atendimento.');
    },
  });

  const finalizarAtendimentoMutation = useMutation({
    mutationFn: async () => {
      if (!atendimentoAtivo) throw new Error('Nenhum atendimento ativo');
      await api.post(`/app/profissional/atendimentos/${atendimentoAtivo.id}/finalizar`, {});
    },
    onSuccess: () => {
      setAtendimentoAtivo(null);
      queryClient.invalidateQueries({ queryKey: ['ponto-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['atendimentos-hoje'] });
      Alert.alert('Atendimento finalizado!', 'O atendimento foi registrado no sistema.');
    },
    onError: (err: any) => {
      Alert.alert('Erro', err.userMessage ?? 'Não foi possível finalizar o atendimento.');
    },
  });

  const addProdutoMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await api.post('/app/profissional/produtos-utilizados', body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos-utilizados'] });
      setModalProduto(false);
      setMarca('');
      setColoracao('');
      setQuantidade('1');
      Alert.alert('Produto adicionado!');
    },
    onError: (err: any) => {
      Alert.alert('Erro', err.userMessage ?? 'Não foi possível salvar.');
    },
  });

  const salvarProduto = () => {
    if (!marca.trim()) {
      Alert.alert('Atenção', 'Informe a marca do produto.');
      return;
    }
    addProdutoMutation.mutate({
      marca: marca.trim(),
      coloracao: coloracao.trim() || undefined,
      quantidade: parseFloat(quantidade) || 1,
      agendamento_id: atendimentoAtivo?.id,
      cliente_nome: atendimentoAtivo?.cliente_nome,
    });
  };

  const baterPonto = async (tipo: string) => {
    setLoadingTipo(tipo);
    try {
      await api.post('/app/profissional/ponto', { tipo });
      queryClient.invalidateQueries({ queryKey: ['ponto-hoje'] });
      Alert.alert('Ponto registrado!', tipoLabel[tipo] ?? tipo);
    } catch (err: any) {
      Alert.alert('Erro', err.userMessage ?? 'Não foi possível registrar.');
    } finally {
      setLoadingTipo(null);
    }
  };

  const confirmarPonto = (tipo: string) => {
    Alert.alert(
      'Bater ponto',
      `Registrar: ${tipoLabel[tipo] ?? tipo}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => baterPonto(tipo) },
      ],
    );
  };

  const confirmarFinalizarAtendimento = () => {
    Alert.alert(
      'Finalizar atendimento',
      `Finalizar atendimento de ${atendimentoAtivo?.cliente_nome ?? 'cliente'}? Isso será registrado no sistema.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Finalizar', style: 'destructive', onPress: () => finalizarAtendimentoMutation.mutate() },
      ],
    );
  };

  const jaEntrou = !!data?.entrada;
  const jaSaiu = !!data?.saida;

  const hoje = new Date().toDateString();
  const produtosHoje = (produtos || []).filter(p => new Date(p.created_at).toDateString() === hoje);
  const produtosAtendimentoAtivo = atendimentoAtivo
    ? produtosHoje.filter(p => p.agendamento_id === atendimentoAtivo.id)
    : produtosHoje;

  return (
    <View className="flex-1 bg-pro-bg">
      <View className="bg-secondary pt-14 pb-6 px-6">
        <Text className="text-white text-xl font-bold">Ponto</Text>
        {data?.horasTrabalhadas && (
          <Text className="text-indigo-200 text-sm mt-1">
            {data.horasTrabalhadas}h trabalhadas hoje
          </Text>
        )}
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { refetch(); refetchProdutos(); }}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
      >
        {isLoading ? <Loading /> : (
          <>
            {/* Status atual */}
            <View className="bg-white rounded-2xl border border-border p-4 mb-4">
              <Text className="text-text font-bold mb-2">Hoje</Text>
              {data?.entrada && (
                <View className="flex-row items-center mb-1">
                  <Ionicons name="log-in-outline" size={16} color="#22c55e" />
                  <Text className="text-muted text-sm ml-2">Entrada: {formatTime(data.entrada.timestamp)}</Text>
                </View>
              )}
              {data?.saida && (
                <View className="flex-row items-center">
                  <Ionicons name="log-out-outline" size={16} color="#ef4444" />
                  <Text className="text-muted text-sm ml-2">Saída: {formatTime(data.saida.timestamp)}</Text>
                </View>
              )}
              {!data?.entrada && <Text className="text-muted text-sm">Nenhum registro hoje.</Text>}
            </View>

            {/* Atendimento ativo */}
            {atendimentoAtivo && (
              <View className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <View className="w-2 h-2 bg-indigo-600 rounded-full mr-2" />
                    <Text className="text-indigo-800 font-bold">Em atendimento</Text>
                  </View>
                  <TouchableOpacity
                    onPress={confirmarFinalizarAtendimento}
                    disabled={finalizarAtendimentoMutation.isPending}
                    className="bg-indigo-600 px-3 py-1.5 rounded-xl"
                  >
                    <Text className="text-white text-xs font-bold">
                      {finalizarAtendimentoMutation.isPending ? 'Finalizando...' : 'Finalizar'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-indigo-900 font-semibold">{atendimentoAtivo.cliente_nome ?? 'Cliente'}</Text>
                {atendimentoAtivo.servico_nome && (
                  <Text className="text-indigo-600 text-sm">{atendimentoAtivo.servico_nome}</Text>
                )}

                {/* Produtos do atendimento */}
                <View className="mt-3 border-t border-indigo-200 pt-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-indigo-800 text-sm font-semibold">Produtos utilizados</Text>
                    <TouchableOpacity
                      onPress={() => setModalProduto(true)}
                      className="flex-row items-center bg-indigo-600 px-2 py-1 rounded-lg"
                    >
                      <Ionicons name="add" size={14} color="white" />
                      <Text className="text-white text-xs font-bold ml-1">Adicionar</Text>
                    </TouchableOpacity>
                  </View>
                  {produtosAtendimentoAtivo.length === 0 ? (
                    <Text className="text-indigo-500 text-xs">Nenhum produto adicionado.</Text>
                  ) : (
                    produtosAtendimentoAtivo.map(p => (
                      <View key={p.id} className="flex-row items-center py-1">
                        <Ionicons name="flask-outline" size={14} color="#6366f1" />
                        <Text className="text-indigo-800 text-sm ml-2 flex-1">
                          {p.marca}{p.coloracao ? ` · ${p.coloracao}` : ''} — {p.quantidade}ml
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}

            {/* Botões de ponto */}
            {jaEntrou && !jaSaiu && !atendimentoAtivo && (
              <TouchableOpacity
                onPress={() => setModalAtendimento(true)}
                className="rounded-2xl mb-3 py-4 items-center"
                style={{ backgroundColor: '#6366f1' }}
              >
                <Ionicons name="play-circle-outline" size={24} color="white" />
                <Text className="text-white font-bold mt-1">Iniciar atendimento</Text>
              </TouchableOpacity>
            )}

            {!jaEntrou && (
              <TouchableOpacity
                onPress={() => confirmarPonto('entrada')}
                disabled={loadingTipo !== null}
                className="rounded-2xl mb-3 py-4 items-center"
                style={{ backgroundColor: '#22c55e', opacity: loadingTipo ? 0.7 : 1 }}
              >
                <Ionicons name="log-in-outline" size={24} color="white" />
                <Text className="text-white font-bold mt-1">Registrar entrada</Text>
              </TouchableOpacity>
            )}

            {jaEntrou && !jaSaiu && (
              <>
                <TouchableOpacity
                  onPress={() => confirmarPonto('pausa')}
                  disabled={loadingTipo !== null}
                  className="rounded-2xl mb-3 py-4 items-center"
                  style={{ backgroundColor: '#f59e0b', opacity: loadingTipo ? 0.7 : 1 }}
                >
                  <Ionicons name="pause-circle-outline" size={24} color="white" />
                  <Text className="text-white font-bold mt-1">Pausar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmarPonto('retorno_pausa')}
                  disabled={loadingTipo !== null}
                  className="rounded-2xl mb-3 py-4 items-center"
                  style={{ backgroundColor: '#6366f1', opacity: loadingTipo ? 0.7 : 1 }}
                >
                  <Ionicons name="play-outline" size={24} color="white" />
                  <Text className="text-white font-bold mt-1">Retornar da pausa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmarPonto('saida')}
                  disabled={loadingTipo !== null}
                  className="rounded-2xl mb-3 py-4 items-center"
                  style={{ backgroundColor: '#ef4444', opacity: loadingTipo ? 0.7 : 1 }}
                >
                  <Ionicons name="log-out-outline" size={24} color="white" />
                  <Text className="text-white font-bold mt-1">Registrar saída</Text>
                </TouchableOpacity>
              </>
            )}

            {jaSaiu && (
              <View className="items-center py-4">
                <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                <Text className="text-text font-semibold mt-2">Jornada encerrada</Text>
                <TouchableOpacity
                  onPress={() => Alert.alert(
                    'Reabrir jornada',
                    'Registrar uma nova entrada para continuar trabalhando?',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Confirmar', onPress: () => baterPonto('entrada') },
                    ]
                  )}
                  className="mt-3 border border-indigo-400 rounded-xl px-5 py-2"
                >
                  <Text className="text-indigo-600 font-medium text-sm">Reabrir jornada</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Timeline */}
            {data?.registros && data.registros.length > 0 && (
              <View className="bg-white rounded-2xl border border-border p-4 mt-2 mb-4">
                <Text className="text-text font-bold mb-3">Timeline do dia</Text>
                {data.registros.map((r) => (
                  <View key={r.id} className="flex-row items-center mb-3">
                    <View className="w-8 h-8 bg-indigo-100 rounded-full items-center justify-center mr-3">
                      <Ionicons name={tipoIcon[r.tipo] ?? 'time-outline'} size={16} color="#6366f1" />
                    </View>
                    <View>
                      <Text className="text-text text-sm font-medium">{tipoLabel[r.tipo] ?? r.tipo}</Text>
                      <Text className="text-muted text-xs">{formatTime(r.timestamp)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Histórico de produtos */}
            {produtos && produtos.length > 0 && (
              <View className="bg-white rounded-2xl border border-border p-4 mb-8">
                <Text className="text-text font-bold mb-3">Histórico de produtos</Text>
                {produtos.slice(0, 20).map((p) => (
                  <View key={p.id} className="flex-row items-start py-2 border-b border-gray-100">
                    <View className="w-8 h-8 bg-purple-100 rounded-full items-center justify-center mr-3 mt-0.5">
                      <Ionicons name="flask-outline" size={16} color="#7c3aed" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-text text-sm font-semibold">{p.marca}</Text>
                      {p.coloracao ? <Text className="text-muted text-xs">{p.coloracao}</Text> : null}
                      <View className="flex-row items-center mt-0.5">
                        <Text className="text-muted text-xs">Qtd: {p.quantidade}</Text>
                        {p.cliente_nome ? <Text className="text-muted text-xs ml-2">· {p.cliente_nome}</Text> : null}
                      </View>
                    </View>
                    <Text className="text-muted text-xs">{formatDate(p.created_at)}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Modal selecionar atendimento */}
      <Modal visible={modalAtendimento} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 max-h-3/4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text font-bold text-lg">Selecionar atendimento</Text>
              <TouchableOpacity onPress={() => setModalAtendimento(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            {!agendamentosHoje || agendamentosHoje.length === 0 ? (
              <Text className="text-muted text-center py-8">Nenhum agendamento para hoje.</Text>
            ) : (
              <FlatList
                data={agendamentosHoje}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => iniciarAtendimentoMutation.mutate(item)}
                    disabled={iniciarAtendimentoMutation.isPending}
                    className="flex-row items-center py-3 border-b border-gray-100"
                  >
                    <View className="w-10 h-10 bg-indigo-100 rounded-full items-center justify-center mr-3">
                      <Ionicons name="person-outline" size={20} color="#6366f1" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-text font-semibold">{item.cliente_nome ?? 'Cliente'}</Text>
                      <Text className="text-muted text-sm">{item.servico_nome ?? ''}</Text>
                    </View>
                    {item.hora_agendamento && (
                      <Text className="text-muted text-sm">{item.hora_agendamento.slice(0, 5)}</Text>
                    )}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Modal adicionar produto */}
      <Modal visible={modalProduto} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-text font-bold text-lg">Adicionar produto</Text>
              <TouchableOpacity onPress={() => setModalProduto(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            {atendimentoAtivo && (
              <View className="bg-indigo-50 rounded-xl px-3 py-2 mb-3">
                <Text className="text-indigo-700 text-sm">
                  Cliente: <Text className="font-bold">{atendimentoAtivo.cliente_nome}</Text>
                </Text>
              </View>
            )}

            <Text className="text-text text-sm font-medium mb-1">Marca *</Text>
            <TextInput
              value={marca}
              onChangeText={setMarca}
              placeholder="Ex: Wella, L'Oréal..."
              placeholderTextColor="#9ca3af"
              className="border border-gray-200 rounded-xl px-4 py-3 text-text mb-3"
            />

            <Text className="text-text text-sm font-medium mb-1">Coloração / Produto</Text>
            <TextInput
              value={coloracao}
              onChangeText={setColoracao}
              placeholder="Ex: 7.1 Louro Acinzentado..."
              placeholderTextColor="#9ca3af"
              className="border border-gray-200 rounded-xl px-4 py-3 text-text mb-3"
            />

            <Text className="text-text text-sm font-medium mb-1">Quantidade (ml)</Text>
            <TextInput
              value={quantidade}
              onChangeText={setQuantidade}
              keyboardType="numeric"
              placeholder="Ex: 50"
              placeholderTextColor="#9ca3af"
              className="border border-gray-200 rounded-xl px-4 py-3 text-text mb-6"
            />

            <TouchableOpacity
              onPress={salvarProduto}
              disabled={addProdutoMutation.isPending}
              className="bg-indigo-600 rounded-2xl py-4 items-center"
              style={{ opacity: addProdutoMutation.isPending ? 0.7 : 1 }}
            >
              <Text className="text-white font-bold text-base">
                {addProdutoMutation.isPending ? 'Salvando...' : 'Salvar produto'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
