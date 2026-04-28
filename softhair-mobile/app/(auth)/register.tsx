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
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';

export default function RegisterScreen() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { registerCliente } = useAuth();

  const handleRegister = async () => {
    if (!nome.trim() || !email.trim() || !password) {
      Alert.alert('Atenção', 'Preencha nome, e-mail e senha.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Atenção', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await registerCliente(nome.trim(), email.trim(), password, telefone.trim());
    } catch (err: any) {
      console.error('REGISTER FULL ERROR:', JSON.stringify(err?.response?.data ?? err?.message ?? err));
      Alert.alert('Erro ao criar conta', err.userMessage ?? err?.response?.data?.error ?? 'Tente novamente.');
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
        <View className="flex-1 px-6 pt-16 pb-10">
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity className="mb-6">
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
          </Link>

          <Text className="text-3xl font-bold text-text mb-2">Criar conta</Text>
          <Text className="text-muted mb-8">
            Acesse os melhores salões de beleza
          </Text>

          <Input
            label="Nome completo"
            placeholder="Seu nome"
            value={nome}
            onChangeText={setNome}
          />
          <Input
            label="E-mail"
            placeholder="seu@email.com"
            type="email"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Telefone (opcional)"
            placeholder="(11) 99999-9999"
            type="phone"
            value={telefone}
            onChangeText={setTelefone}
          />
          <Input
            label="Senha"
            placeholder="Mínimo 6 caracteres"
            type="password"
            value={password}
            onChangeText={setPassword}
          />

          <View className="mt-2 mb-6">
            <Button
              label="Criar conta"
              onPress={handleRegister}
              loading={loading}
            />
          </View>

          <View className="flex-row justify-center">
            <Text className="text-muted">Já tem conta? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-primary font-semibold">Entrar</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
