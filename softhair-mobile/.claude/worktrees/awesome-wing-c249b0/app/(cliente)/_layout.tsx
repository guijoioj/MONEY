import { Stack } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { Redirect } from 'expo-router';
import { useWebSocket } from '../../hooks/useWebSocket';

function WSConnector() {
  useWebSocket();
  return null;
}

export default function ClienteLayout() {
  const { isAuthenticated, userType } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (userType === 'profissional') {
    return <Redirect href="/(profissional)/(tabs)/agenda" />;
  }

  return (
    <>
      <WSConnector />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="salao/[id]" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="produto/[id]" options={{ headerShown: false, presentation: 'card' }} />
      </Stack>
    </>
  );
}
