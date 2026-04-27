# app/(cliente)/(tabs)/perfil.tsx

**Repository:** Mobile
**File:** `app/(cliente)/(tabs)/perfil.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `app/(cliente)/(tabs)/perfil.tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/auth|auth]]
- [[domains/clientes|clientes]]
- [[domains/sync|sync]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]
- [[domains/state|state]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import api from '../../../services/api';

export default function PerfilClienteScreen() {
  const { user, logout } = useAuth();
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(user?.nome ?? '');
  const [telefone, setTelefone] = useState(user?.telefone ?? '');
  const [loading, setLoading] = useState(false);

  const handleSalvar = async () => {
    setLoading(true);
    try {
      await api.put('/app/auth/perfil', { nome, telefone });
      Alert.alert('Sucesso', 'Perfil atualizado.');
      setEditando(false);
    } catch (err: any) {
      Alert.alert('Erro', err.userMessage ?? 'Não foi possível atualizar.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      <View className="bg-primary pt-14 pb-8 px-6 items-center">
        <View className="w-20 h-20 bg-white/20 rounded-full items-center justify-center mb-3">
          <Ionicons name="person" size={36} color="white" />
        </View>
        <Text className="text-white text-xl font-bold">{user?.nome}</Text>
        <Text className="text-pink-200 text-sm mt-1">{user?.email}</Text>
      </View>

      <ScrollView className="flex-1 px-6 pt-6">
        {editando ? (
          <>
            <Input
              label="Nome"
              value={nome}
              onChangeText={setNome}
            />
            <Input
              label="Telefone"
              value={telefone}
              onChangeText={setTelefone}
              type="phone"
            />
            <View className="flex-row gap-3 mt-2 mb-6">
              <View className="flex-1">
                <Button
                  label="Cancelar"
                  variant="outline"
                  onPress={() => setEditando(false)}
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Salvar"
                  onPress={handleSalvar}
                  loading={loading}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <View className="bg-white rounded-2xl border border-border p-4 mb-4">
              <InfoRow icon="person-outline" label="Nome" value={user?.nome ?? ''} />
              <InfoRow icon="mail-outline" label="E-mail" value={user?.email ?? ''} />
              {user?.telefone && (
                <InfoRow icon="call-outline" label="Telefone" value={user.telefone} />
              )}
            </View>

            <Button
              label="Editar perfil"
              variant="outline"
              onPress={() => setEditando(true)}
            />
            <View className="mt-3">
              <Button label="Sair" variant="danger" onPress={handleLogout} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center py-3 border-b border-border last:border-0">
      <Ionicons name={icon} size={18} color="#6b7280" />
      <View className="ml-3">
        <Text className="text-xs text-muted uppercase font-medium">{label}</Text>
        <Text className="text-text text-sm mt-0.5">{value}</Text>
      </View>
    </View>
  );
}
```
