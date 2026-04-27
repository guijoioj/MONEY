import { Stack } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { Redirect } from 'expo-router';

export default function AuthLayout() {
  const { isAuthenticated, userType } = useAuthStore();

  if (isAuthenticated) {
    if (userType === 'profissional') {
      return <Redirect href="/(profissional)/(tabs)/agenda" />;
    }
    return <Redirect href="/(cliente)/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
