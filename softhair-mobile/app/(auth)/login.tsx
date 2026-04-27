import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';

type LoginTab = 'cliente' | 'profissional';

export default function LoginScreen() {
  const [tab, setTab] = useState<LoginTab>('cliente');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginCliente, loginProfissional } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Atenção', 'Preencha email e senha.');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'cliente') {
        await loginCliente(email.trim(), password);
      } else {
        await loginProfissional(email.trim(), password);
      }
    } catch (err: any) {
      Alert.alert('Erro ao entrar', err.userMessage ?? 'Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 pt-20 pb-10">
          {/* Header */}
          <View className="items-center mb-10">
            <View className="w-20 h-20 bg-primary rounded-3xl items-center justify-center mb-4">
              <Text className="text-white text-4xl font-bold">S</Text>
            </View>
            <Text className="text-3xl font-bold text-text">SoftHair</Text>
            <Text className="text-muted text-base mt-1">
              Sistema de gestão de salão
            </Text>
          </View>

          {/* Tabs */}
          <View className="flex-row bg-gray-100 rounded-2xl p-1 mb-8">
            {(['cliente', 'profissional'] as LoginTab[]).map((t) => (
              <TouchableOpacity
                key={t}
                className={`flex-1 py-3 rounded-xl items-center ${
                  tab === t ? 'bg-primary' : ''
                }`}
                onPress={() => setTab(t)}
              >
                <Text
                  className={`font-semibold text-sm ${
                    tab === t ? 'text-white' : 'text-muted'
                  }`}
                >
                  {t === 'cliente' ? 'Cliente' : 'Profissional'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Form */}
          <Input
            label="E-mail"
            placeholder="seu@email.com"
            type="email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            label="Senha"
            placeholder="••••••••"
            type="password"
            value={password}
            onChangeText={setPassword}
          />

          <View className="mt-2 mb-6">
            <Button
              label="Entrar"
              onPress={handleLogin}
              loading={loading}
            />
          </View>

          {tab === 'cliente' && (
            <View className="flex-row justify-center">
              <Text className="text-muted">Não tem conta? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text className="text-primary font-semibold">
                    Criar conta
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          )}

          {tab === 'profissional' && (
            <Text className="text-muted text-center text-sm">
              Use as credenciais cadastradas pelo administrador do salão.
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
