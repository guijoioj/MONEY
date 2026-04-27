import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useCarrinhoStore } from '../../../store/carrinhoStore';

function TabIcon({
  name,
  focused,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  badge?: number;
}) {
  return (
    <View>
      <Ionicons name={name} size={24} color={focused ? '#db2777' : '#9ca3af'} />
      {badge != null && badge > 0 && (
        <View
          className="absolute -top-1 -right-2 bg-primary rounded-full min-w-4 h-4 items-center justify-center px-1"
        >
          <Text className="text-white text-xs font-bold">{badge}</Text>
        </View>
      )}
    </View>
  );
}

export default function ClienteTabsLayout() {
  const itens = useCarrinhoStore((s) => s.itens);
  const totalItens = itens.reduce((a, i) => a + i.quantidade, 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#db2777',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e5e7eb',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="pedidos"
        options={{
          title: 'Agendamentos',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="loja"
        options={{
          title: 'Loja',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'storefront' : 'storefront-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="carrinho"
        options={{
          title: 'Carrinho',
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'cart' : 'cart-outline'}
              focused={focused}
              badge={totalItens}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="meus-pedidos-loja"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'receipt' : 'receipt-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="agendar" options={{ href: null }} />
    </Tabs>
  );
}
