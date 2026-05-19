import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#ec4899' }, headerTintColor: '#fff' }}>
      <Stack.Screen name="comissoes" options={{ title: 'Comissões' }} />
      <Stack.Screen name="regras-comissao" options={{ title: 'Regras de Comissão' }} />
      <Stack.Screen name="pagamento-comissao" options={{ title: 'Pagar Comissão' }} />
      <Stack.Screen name="dashboard" options={{ title: 'Dashboard Admin' }} />
    </Stack>
  );
}
