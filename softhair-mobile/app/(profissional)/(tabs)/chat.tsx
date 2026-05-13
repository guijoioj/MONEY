import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuthStore } from '../../../store/authStore';
import { wsManager } from '../../../services/websocket';
import api from '../../../services/api';

interface Mensagem {
  id?: number;
  remetente_tipo: string;
  mensagem: string;
  created_at: string;
}

export default function Chat() {
  const { user } = useAuthStore();
  const salaoId = user?.salonId;
  const profissionalId = user?.profissionalId || user?.id;

  const [mensagem, setMensagem] = useState('');
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const flatListRef = useRef<FlatList>(null);

  // Buscar histórico
  useEffect(() => {
    api
      .get('/app/profissional/chat')
      .then((res) => {
        setMensagens(res.data?.data || []);
      })
      .catch((err) => console.warn('[Chat] Erro ao buscar histórico:', err.message));
  }, []);

  // Escutar novas mensagens via WebSocket
  useEffect(() => {
    const unsubscribe = wsManager.onMessage((msg: any) => {
      if (msg.type === 'CHAT_MESSAGE') {
        setMensagens((prev) => [...prev, msg.data]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });
    return unsubscribe;
  }, []);

  const enviar = () => {
    const texto = mensagem.trim();
    if (!texto) return;

    wsManager.send({
      type: 'CHAT_MESSAGE',
      salaoId,
      remetenteId: profissionalId,
      remetenteTipo: 'profissional',
      destinatarioId: 0,
      destinatarioTipo: 'admin',
      mensagem: texto,
    });

    const novaMensagem: Mensagem = {
      remetente_tipo: 'profissional',
      mensagem: texto,
      created_at: new Date().toISOString(),
    };
    setMensagens((prev) => [...prev, novaMensagem]);
    setMensagem('');
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const formatHora = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: '#fff',
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
            padding: 16,
            paddingTop: 48,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937' }}>
            Chat com Recepção
          </Text>
          <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            {wsManager.isConnected() ? '● Conectado' : '○ Desconectado'}
          </Text>
        </View>

        {/* Mensagens */}
        <FlatList
          ref={flatListRef}
          data={mensagens}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const isProfissional = item.remetente_tipo === 'profissional';
            return (
              <View
                style={{
                  marginBottom: 12,
                  alignItems: isProfissional ? 'flex-end' : 'flex-start',
                }}
              >
                <View
                  style={{
                    maxWidth: '75%',
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    backgroundColor: isProfissional ? '#4f46e5' : '#fff',
                    borderWidth: isProfissional ? 0 : 1,
                    borderColor: '#e5e7eb',
                  }}
                >
                  <Text
                    style={{
                      color: isProfissional ? '#fff' : '#1f2937',
                      fontSize: 14,
                    }}
                  >
                    {item.mensagem}
                  </Text>
                  <Text
                    style={{
                      color: isProfissional ? 'rgba(255,255,255,0.6)' : '#9ca3af',
                      fontSize: 10,
                      marginTop: 2,
                      textAlign: 'right',
                    }}
                  >
                    {formatHora(item.created_at)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/* Input */}
        <View
          style={{
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              backgroundColor: '#f3f4f6',
              borderRadius: 24,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 14,
              color: '#1f2937',
            }}
            placeholder="Mensagem..."
            placeholderTextColor="#9ca3af"
            value={mensagem}
            onChangeText={setMensagem}
            onSubmitEditing={enviar}
            returnKeyType="send"
          />
          <TouchableOpacity
            onPress={enviar}
            style={{
              backgroundColor: '#4f46e5',
              borderRadius: 24,
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 20, lineHeight: 24 }}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
