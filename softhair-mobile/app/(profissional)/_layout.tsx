import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useWebSocket } from '../../hooks/useWebSocket';

function WSConnector() {
  useWebSocket();
  return null;
}

export default function ProfissionalLayout() {
  const { isAuthenticated, userType } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (userType === 'cliente') {
    return <Redirect href="/(cliente)/(tabs)" />;
  }

  return (
    <>
      <WSConnector />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
