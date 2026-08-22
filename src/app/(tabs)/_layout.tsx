import { typography } from '@/constants/theme';
import { useAppearance } from '@/store/appearance';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

const icons = { index: ['home-outline', 'home'], pos: ['cart-outline', 'cart'], inventory: ['cube-outline', 'cube'], utang: ['people-outline', 'people'], reports: ['bar-chart-outline', 'bar-chart'] } as const;
export default function TabLayout() {
  const { colors } = useAppearance();
  return <Tabs screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textSecondary, tabBarLabelStyle: { fontSize: typography.caption, fontWeight: '600' }, tabBarStyle: { height: 66, paddingTop: 7, paddingBottom: 8, borderTopColor: colors.border, backgroundColor: colors.surface }, tabBarIcon: ({ color, focused, size }) => { const names = icons[route.name as keyof typeof icons]; return <Ionicons name={(focused ? names[1] : names[0]) as keyof typeof Ionicons.glyphMap} size={size} color={color} />; } })}>
    <Tabs.Screen name="index" options={{ title: 'Home' }} /><Tabs.Screen name="pos" options={{ title: 'POS' }} /><Tabs.Screen name="inventory" options={{ title: 'Inventory' }} /><Tabs.Screen name="utang" options={{ title: 'Utang' }} /><Tabs.Screen name="reports" options={{ title: 'Reports' }} />
  </Tabs>;
}
