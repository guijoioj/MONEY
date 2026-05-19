/**
 * Tela "Configurar Servidor" — escolhe entre Render / cérebro local / custom.
 *
 * Acessível: pré-login (footer link), ou via menu pós-login.
 */

import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getServerConfig, setServerConfig, testConnection, PRESETS, type ServerConfig } from '../services/serverConfig';
import { setApiBaseURL } from '../services/api';

export default function ConfigurarServidor() {
  const router = useRouter();
  const [mode, setMode] = useState<ServerConfig['mode']>('render');
  const [url, setUrl] = useState(PRESETS.render);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; latency?: number; error?: string } | null>(null);

  useEffect(() => {
    getServerConfig().then(cfg => {
      setMode(cfg.mode);
      setUrl(cfg.url);
    });
  }, []);

  const applyPreset = (m: ServerConfig['mode']) => {
    setMode(m);
    if (m === 'render') setUrl(PRESETS.render);
    else if (m === 'local') setUrl(PRESETS.local);
    // custom: mantém URL atual
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const r = await testConnection(url);
    setTestResult(r);
    setTesting(false);
  };

  const handleSave = async () => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('URL inválida', 'Deve começar com http:// ou https://');
      return;
    }
    await setServerConfig({ mode, url });
    setApiBaseURL(url);
    Alert.alert('Salvo!', 'Reinicie o app pra garantir efeito.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-5">
        <Text className="text-2xl font-bold mb-2 text-gray-900">Configurar Servidor</Text>
        <Text className="text-sm text-gray-500 mb-6">
          Escolha onde o app vai se conectar. Mude pra "Cérebro local" se o salão tem servidor próprio.
        </Text>

        {/* Render */}
        <TouchableOpacity
          onPress={() => applyPreset('render')}
          className={`p-4 rounded-lg border-2 mb-3 ${mode === 'render' ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white'}`}
        >
          <Text className="font-bold text-gray-900">☁️ Servidor na Nuvem (Render)</Text>
          <Text className="text-xs text-gray-500 mt-1">Conexão com internet obrigatória. Default.</Text>
          <Text className="text-xs text-gray-400 mt-1 font-mono">{PRESETS.render}</Text>
        </TouchableOpacity>

        {/* Local */}
        <TouchableOpacity
          onPress={() => applyPreset('local')}
          className={`p-4 rounded-lg border-2 mb-3 ${mode === 'local' ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white'}`}
        >
          <Text className="font-bold text-gray-900">🏠 Cérebro Local do Salão</Text>
          <Text className="text-xs text-gray-500 mt-1">Servidor próprio na rede do salão. Funciona offline.</Text>
          <Text className="text-xs text-gray-400 mt-1 font-mono">{PRESETS.local}</Text>
        </TouchableOpacity>

        {/* Custom */}
        <TouchableOpacity
          onPress={() => applyPreset('custom')}
          className={`p-4 rounded-lg border-2 mb-3 ${mode === 'custom' ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white'}`}
        >
          <Text className="font-bold text-gray-900">⚙️ Customizado</Text>
          <Text className="text-xs text-gray-500 mt-1">URL específica (ex: outro IP local, staging).</Text>
        </TouchableOpacity>

        {/* URL input */}
        <Text className="text-sm font-semibold text-gray-700 mt-4 mb-1">URL do servidor</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://exemplo.com ou http://192.168.1.10:3001"
          autoCapitalize="none"
          autoCorrect={false}
          editable={mode === 'custom'}
          className={`border rounded-lg p-3 text-sm font-mono ${mode === 'custom' ? 'border-pink-300 bg-white' : 'border-gray-200 bg-gray-50 text-gray-500'}`}
        />

        {/* Test */}
        <TouchableOpacity
          onPress={handleTest}
          disabled={testing}
          className="mt-4 bg-indigo-500 disabled:bg-gray-300 rounded-lg p-3 items-center"
        >
          {testing ? <ActivityIndicator color="white" /> : (
            <Text className="text-white font-semibold">Testar Conexão</Text>
          )}
        </TouchableOpacity>

        {testResult && (
          <View className={`mt-3 p-3 rounded-lg ${testResult.ok ? 'bg-green-50' : 'bg-red-50'}`}>
            {testResult.ok ? (
              <Text className="text-green-700 font-medium">
                ✓ Conectou! Latência: {testResult.latency}ms
              </Text>
            ) : (
              <Text className="text-red-700 font-medium">
                ✗ Falhou: {testResult.error}
              </Text>
            )}
          </View>
        )}

        {/* Save */}
        <TouchableOpacity
          onPress={handleSave}
          className="mt-6 bg-pink-500 rounded-lg p-4 items-center"
        >
          <Text className="text-white font-bold text-base">Salvar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
