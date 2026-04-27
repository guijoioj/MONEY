import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const { isAuthenticated, userType } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (userType === 'profissional') {
    return <Redirect href="/(profissional)/(tabs)/agenda" />;
  }

  return <Redirect href="/(cliente)/(tabs)" />;
}
