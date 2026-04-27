# app/(cliente)/(tabs)/agendar.tsx

**Repository:** Mobile
**File:** `app/(cliente)/(tabs)/agendar.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `app/(cliente)/(tabs)/agendar.tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/agendamentos|agendamentos]]
- [[domains/clientes|clientes]]
- [[domains/profissionais|profissionais]]
- [[domains/servicos|servicos]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
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
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Loading } from '../../../components/ui/Loading';

function formatarData(date: Date) {
  return date.toISOString().split('T')[0];
}

function formatarDataExibicao(dateStr: string) {
  if (!dateStr) return '';
  const [ano, mes, dia] = dateStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

interface Servico {
  id: string;
  nome: string;
  preco: number;
  duracao: number;
  categoria?: string;
}

interface Profissional {
  id: string;
  nome: string;
  especialidade?: string;
  disponivel?: boolean;
}

export default function AgendarScreen() {
  const params = useLocalSearchParams<{ salonId?: string; salaoNome?: string }>();
  const router = useRouter();

  const [salonIdInput, setSalonIdInput] = useState(params.salonId ?? '');
  const [servicoId, setServicoId] = useState('');
  const [profissionalId, setProfissionalId] = useState('');
  const [dataDesejada, setDataDesejada] = useState('');
  const [horarioDesejado, setHorarioDesejado] = useState('');
  const [horarioAlternativo, setHorarioAlternativo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showAltTimePicker, setShowAltTimePicker] = useState(false);
  const [dateObj, setDateObj] = useState(new Date());
  const [timeObj, setTimeObj] = useState(new Date());
  const [altTimeObj, setAltTimeObj] = useState(new Date());

  const salonId = params.salonId || salonIdInput;

  const { data: servicos, isLoading: loadingServicos } = useQuery({
    queryKey: ['servicos', salonId],
    queryFn: async () => {
      const res = await api.get(`/app/pedidos/saloes/${salonId}/servicos`);
      return res.data.data as Servico[];
    },
    enabled: !!salonId,
  });

  const { data: profissionais } = useQuery({
    queryKey: ['profissionais', salonId, dataDesejada, horarioDesejado, servicoId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (dataDesejada && horarioDesejado) {
        params.data = dataDesejada;
        params.horario = horarioDesejado;
        if (servicoId) params.servicoId = servicoId;
      }
      const res = await api.get(`/app/pedidos/saloes/${salonId}/profissionais`, { params });
      return res.data.data as Profissional[];
    },
    enabled: !!salonId,
  });

  const handleSubmit = async () => {
    if (!salonId || !servicoId || !dataDesejada || !horarioDesejado) {
      Alert.alert('Atenção', 'Preencha salão, serviço, data e horário.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/app/pedidos/', {
        salonId,
        servicoId,
        profissionalId: profissionalId || undefined,
        dataDesejada,
        horarioDesejado,
        horarioAlternativo: horarioAlternativo || undefined,
        observacoes: observacoes || undefined,
      });
      Alert.alert(
        'Pedido enviado!',
        'A recepcionista irá confirmar em breve.',
        [{ text: 'OK', onPress: () => router.replace('/(cliente)/(tabs)/pedidos') }],
      );
    } catch (err: any) {
      Alert.alert('Erro', err.userMessage ?? 'Não foi possível enviar o pedido.');
    } finally {
      setLoading(false);
    }
  };

  const servicoSelecionado = servicos?.find((s) => s.id === servicoId);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <View className="bg-primary pt-14 pb-6 px-6">
        <TouchableOpacity onPress={() => router.back()} className="mb-3">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Solicitar Agendamento</Text>
        {params.salaoNome && (
          <Text className="text-pink-200 mt-1">{params.salaoNome}</Text>
        )}
      </View>

      <ScrollView className="flex-1 px-6 pt-6" keyboardShouldPersistTaps="handled">
        
        <Text className="text-text font-semibold mb-3">Serviço *</Text>
        {loadingServicos ? (
          <Loading />
        ) : servicos && servicos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2 pr-4">
              {servicos.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setServicoId(s.id)}
                  className={`px-4 py-3 rounded-xl border-2 min-w-36 ${
                    servicoId === s.id
                      ? 'border-primary bg-pink-50'
                      : 'border-border bg-white'
                  }`}
                >
                  <Text
                    className={`font-semibold text-sm ${
                      servicoId === s.id ? 'text-primary' : 'text-text'
                    }`}
                    numberOfLines={2}
                  >
                    {s.nome}
                  </Text>
                  <Text className="text-muted text-xs mt-1">
                    R$ {s.preco.toFixed(2)} · {s.duracao}min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : salonId ? (
          <Text className="text-muted mb-4">Nenhum serviço disponível.</Text>
        ) : (
          <Text className="text-muted mb-4">Selecione um salão primeiro.</Text>
        )}


        {profissionais && profissionais.length > 0 && (
          <>
            <Text className="text-text font-semibold mb-1">
              Profissional (opcional)
            </Text>
            {dataDesejada && horarioDesejado && (
              <Text className="text-muted text-xs mb-3">
                Profissionais com 🔒 estão ocupados no horário selecionado
              </Text>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2 pr-4">
                <TouchableOpacity
                  onPress={() => setProfissionalId('')}
                  className={`px-4 py-3 rounded-xl border-2 ${
                    profissionalId === ''
                      ? 'border-primary bg-pink-50'
                      : 'border-border bg-white'
                  }`}
                >
                  <Text
                    className={`font-semibold text-sm ${
                      profissionalId === '' ? 'text-primary' : 'text-text'
                    }`}
                  >
                    Qualquer um
                  </Text>
                </TouchableOpacity>
                {profissionais.map((p) => {
                  const ocupado = dataDesejada && horarioDesejado && p.disponivel === false;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => !ocupado && setProfissionalId(p.id)}
                      disabled={!!ocupado}
                      className={`px-4 py-3 rounded-xl border-2 min-w-32 ${
                        ocupado
                          ? 'border-border bg-gray-100 opacity-50'
                          : profissionalId === p.id
                          ? 'border-primary bg-pink-50'
                          : 'border-border bg-white'
                      }`}
                    >
                      <View className="flex-row items-center gap-1">
                        <Text
                          className={`font-semibold text-sm ${
                            ocupado
                              ? 'text-muted'
                              : profissionalId === p.id
                              ? 'text-primary'
                              : 'text-text'
                          }`}
                        >
                          {p.nome}
                        </Text>
                        {ocupado && (
                          <Ionicons name="lock-closed" size={12} color="#9ca3af" />
                        )}
                      </View>
                      {p.especialidade && (
                        <Text className="text-muted text-xs mt-0.5">
                          {p.especialidade}
                        </Text>
                      )}
                      {ocupado && (
                        <Text className="text-xs mt-0.5" style={{ color: '#ef4444' }}>
                          Ocupado
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </>
        )}

        
        <Text className="text-text font-semibold text-sm mb-2">Data desejada *</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          className="flex-row items-center border border-border bg-white rounded-xl px-4 py-3 mb-4"
        >
          <Ionicons name="calendar-outline" size={20} color="#db2777" />
          <Text className={`ml-3 flex-1 text-sm ${dataDesejada ? 'text-text' : 'text-muted'}`}>
            {dataDesejada ? formatarDataExibicao(dataDesejada) : 'Selecionar data'}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#9ca3af" />
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={dateObj}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
            minimumDate={new Date()}
            onChange={(_, selected) => {
              setShowDatePicker(Platform.OS === 'ios');
              if (selected) {
                setDateObj(selected);
                setDataDesejada(formatarData(selected));
              }
              if (Platform.OS === 'android') setShowDatePicker(false);
            }}
          />
        )}

        
        <Text className="text-text font-semibold text-sm mb-2">Horário desejado *</Text>
        <TouchableOpacity
          onPress={() => setShowTimePicker(true)}
          className="flex-row items-center border border-border bg-white rounded-xl px-4 py-3 mb-4"
        >
          <Ionicons name="time-outline" size={20} color="#db2777" />
          <Text className={`ml-3 flex-1 text-sm ${horarioDesejado ? 'text-text' : 'text-muted'}`}>
            {horarioDesejado || 'Selecionar horário'}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#9ca3af" />
        </TouchableOpacity>

        {showTimePicker && (
          <DateTimePicker
            value={timeObj}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
            onChange={(_, selected) => {
              setShowTimePicker(Platform.OS === 'ios');
              if (selected) {
                setTimeObj(selected);
                const h = selected.getHours().toString().padStart(2, '0');
                const m = selected.getMinutes().toString().padStart(2, '0');
                setHorarioDesejado(`${h}:${m}`);
              }
              if (Platform.OS === 'android') setShowTimePicker(false);
            }}
          />
        )}

        
        <Text className="text-text font-semibold text-sm mb-2">Horário alternativo (opcional)</Text>
        <TouchableOpacity
          onPress={() => setShowAltTimePicker(true)}
          className="flex-row items-center border border-border bg-white rounded-xl px-4 py-3 mb-4"
        >
          <Ionicons name="time-outline" size={20} color="#9ca3af" />
          <Text className={`ml-3 flex-1 text-sm ${horarioAlternativo ? 'text-text' : 'text-muted'}`}>
            {horarioAlternativo || 'Selecionar horário alternativo'}
          </Text>
          {horarioAlternativo ? (
            <TouchableOpacity onPress={() => setHorarioAlternativo('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-down" size={16} color="#9ca3af" />
          )}
        </TouchableOpacity>

        {showAltTimePicker && (
          <DateTimePicker
            value={altTimeObj}
            mode="time"
            is24Hour
            display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
            onChange={(_, selected) => {
              setShowAltTimePicker(Platform.OS === 'ios');
              if (selected) {
                setAltTimeObj(selected);
                const h = selected.getHours().toString().padStart(2, '0');
                const m = selected.getMinutes().toString().padStart(2, '0');
                setHorarioAlternativo(`${h}:${m}`);
              }
              if (Platform.OS === 'android') setShowAltTimePicker(false);
            }}
          />
        )}
        <Input
          label="Observações (opcional)"
          placeholder="Ex: prefiro sem chapinha..."
          value={observacoes}
          onChangeText={setObservacoes}
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: 'top' }}
        />

        {servicoSelecionado && (
          <View className="bg-pink-50 border border-pink-200 rounded-xl p-4 mb-4">
            <Text className="text-primary font-semibold">Resumo</Text>
            <Text className="text-text mt-1">{servicoSelecionado.nome}</Text>
            <Text className="text-muted text-sm">
              R$ {servicoSelecionado.preco.toFixed(2)} · {servicoSelecionado.duracao} min
            </Text>
          </View>
        )}

        <View className="pb-10">
          <Button
            label="Enviar Pedido"
            onPress={handleSubmit}
            loading={loading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```
