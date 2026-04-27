# app/(profissional)/(tabs)/ponto.tsx

**Repository:** Mobile
**File:** `app/(profissional)/(tabs)/ponto.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `app/(profissional)/(tabs)/ponto.tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/profissionais|profissionais]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/security|security]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]
- [[domains/state|state]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Loading } from '../../../components/ui/Loading';


interface RegistroPonto {
  id: string;
  tipo: string;
  timestamp: string;
  observacoes?: string;
}

interface ResumoPonto {
  registros: RegistroPonto[];
  entrada?: RegistroPonto;
  saida?: RegistroPonto;
  horasTrabalhadas?: string;
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
  return new Date(ts).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PontoScreen() {
  const [loadingTipo, setLoadingTipo] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['ponto-hoje'],
    queryFn: async () => {
      const res = await api.get('/app/profissional/ponto');
      return res.data.data as ResumoPonto;
    },
  });

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

  const jaEntrou = !!data?.entrada;
  const jaSaiu = !!data?.saida;

  const botoesPrincipais = jaEntrou
    ? jaSaiu
      ? []
      : [
          { tipo: 'inicio_atendimento', label: 'Iniciar atendimento', color: '#6366f1' },
          { tipo: 'fim_atendimento', label: 'Finalizar atendimento', color: '#22c55e' },
          { tipo: 'pausa', label: 'Pausar', color: '#f59e0b' },
          { tipo: 'retorno_pausa', label: 'Retornar da pausa', color: '#6366f1' },
          { tipo: 'saida', label: 'Registrar saída', color: '#ef4444' },
        ]
    : [{ tipo: 'entrada', label: 'Registrar entrada', color: '#22c55e' }];

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
            onRefresh={refetch}
            colors={['#6366f1']}
            tintColor="#6366f1"
          />
        }
      >
        {isLoading ? (
          <Loading />
        ) : (
          <>
            {/* Status atual */}
            <View className="bg-white rounded-2xl border border-border p-4 mb-4">
              <Text className="text-text font-bold mb-2">Hoje</Text>
              {data?.entrada && (
                <View className="flex-row items-center mb-1">
                  <Ionicons name="log-in-outline" size={16} color="#22c55e" />
                  <Text className="text-muted text-sm ml-2">
                    Entrada: {formatTime(data.entrada.timestamp)}
                  </Text>
                </View>
              )}
              {data?.saida && (
                <View className="flex-row items-center">
                  <Ionicons name="log-out-outline" size={16} color="#ef4444" />
                  <Text className="text-muted text-sm ml-2">
                    Saída: {formatTime(data.saida.timestamp)}
                  </Text>
                </View>
              )}
              {!data?.entrada && (
                <Text className="text-muted text-sm">Nenhum registro hoje.</Text>
              )}
            </View>

            {/* Botões de ponto */}
            {botoesPrincipais.map((b) => (
              <TouchableOpacity
                key={b.tipo}
                onPress={() => confirmarPonto(b.tipo)}
                disabled={loadingTipo !== null}
                className="rounded-2xl mb-3 py-4 items-center"
                style={{ backgroundColor: b.color, opacity: loadingTipo ? 0.7 : 1 }}
              >
                <Ionicons
                  name={tipoIcon[b.tipo] ?? 'time-outline'}
                  size={24}
                  color="white"
                />
                <Text className="text-white font-bold mt-1">{b.label}</Text>
              </TouchableOpacity>
            ))}

            {jaSaiu && (
              <View className="items-center py-4">
                <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                <Text className="text-text font-semibold mt-2">Jornada encerrada</Text>
              </View>
            )}

            {/* Timeline */}
            {data?.registros && data.registros.length > 0 && (
              <View className="bg-white rounded-2xl border border-border p-4 mt-2 mb-8">
                <Text className="text-text font-bold mb-3">Timeline do dia</Text>
                {data.registros.map((r, idx) => (
                  <View key={r.id} className="flex-row items-center mb-3">
                    <View className="w-8 h-8 bg-indigo-100 rounded-full items-center justify-center mr-3">
                      <Ionicons
                        name={tipoIcon[r.tipo] ?? 'time-outline'}
                        size={16}
                        color="#6366f1"
                      />
                    </View>
                    <View>
                      <Text className="text-text text-sm font-medium">
                        {tipoLabel[r.tipo] ?? r.tipo}
                      </Text>
                      <Text className="text-muted text-xs">
                        {formatTime(r.timestamp)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
```
