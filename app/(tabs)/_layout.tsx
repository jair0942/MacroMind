import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { AppIcon, type IconName } from '@/src/components/AppIcon';
import { colors } from '@/src/constants/colors';

export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accentDark, tabBarInactiveTintColor: colors.textMuted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 78, paddingTop: 8, paddingBottom: 8 }, tabBarLabelStyle: { fontSize: 10, fontWeight: '700' } }}>
    <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }} />
    <Tabs.Screen name="scan" options={{ title: 'Registrar', tabBarIcon: ({ color }) => <TabIcon name="scan" color={color} /> }} />
    <Tabs.Screen name="history" options={{ title: 'Historial', tabBarIcon: ({ color }) => <TabIcon name="history" color={color} /> }} />
    <Tabs.Screen name="progress" options={{ title: 'Estadísticas', tabBarIcon: ({ color }) => <TabIcon name="stats" color={color} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} /> }} />
    <Tabs.Screen name="two" options={{ href: null }} />
  </Tabs>;
}

function TabIcon({ name, color }: { name: IconName; color: ColorValue }) { return <AppIcon name={name} size={21} color={color} />; }
