import { themeHex } from '@/constants/theme';
import { useAndroidImmersiveNavigation } from '@/hooks/useAndroidImmersiveNavigation';
import { AuthProvider, useAuth } from '@/store/auth';
import { AppearanceProvider, useAppearance } from '@/store/appearance';
import { AppProvider } from '@/store/app';
import { CloudAuthProvider } from '@/store/cloudAuth';
import { SyncProvider } from '@/store/sync';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ComponentProps, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><AppearanceProvider><AppRoot /></AppearanceProvider></GestureHandlerRootView>;
}

function AppRoot() {
  useAndroidImmersiveNavigation();
  const { colorScheme, colors } = useAppearance();
  const segments = useSegments();
  const authenticationScreen = segments[0] === 'login';
  const statusBarBackground = authenticationScreen ? themeHex[colorScheme].background : themeHex[colorScheme].primary;
  return <SafeAreaProvider><AuthProvider><AppProvider><CloudAuthProvider><SyncProvider><StatusBar backgroundColor={statusBarBackground} style={authenticationScreen && colorScheme === 'light' ? 'dark' : 'light'} hidden={false} translucent /><GuardedStack screenOptions={{
    headerStyle: { backgroundColor: colors.primary },
    headerTintColor: colors.primaryText,
    headerTitleStyle: { fontWeight: '600' },
    headerShadowVisible: false,
    ...(Platform.OS === 'android' ? {
      statusBarHidden: false,
      statusBarTranslucent: true,
    } : {}),
  }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="login" options={{ headerShown: false }} />
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="barcode-scanner" options={{ title: 'Scan Barcode' }} />
    <Stack.Screen name="cart" options={{ title: 'Cart / Checkout' }} />
    <Stack.Screen name="pending-sales" options={{ title: 'Pending Sales' }} />
    <Stack.Screen name="payment-success" options={{ title: 'Payment Complete', headerShown: false }} />
    <Stack.Screen name="receipt" options={{ title: 'Receipt' }} />
    <Stack.Screen name="printer-setup" options={{ title: 'Printer Setup' }} />
    <Stack.Screen name="product-details" options={{ title: 'Product Details' }} />
    <Stack.Screen name="add-product" options={{ title: 'Add Product' }} />
    <Stack.Screen name="edit-product" options={{ title: 'Edit Product' }} />
    <Stack.Screen name="stock-movement" options={{ title: 'Stock In / Out' }} />
    <Stack.Screen name="customers" options={{ title: 'Customers' }} />
    <Stack.Screen name="add-customer" options={{ title: 'Add Customer' }} />
    <Stack.Screen name="customer-details" options={{ title: 'Customer Details' }} />
    <Stack.Screen name="customer-utang-details" options={{ title: 'Customer Utang' }} />
    <Stack.Screen name="new-utang" options={{ title: 'New Utang' }} />
    <Stack.Screen name="collect-payment" options={{ title: 'Collect Payment' }} />
    <Stack.Screen name="transaction-details" options={{ title: 'Transaction Details' }} />
    <Stack.Screen name="transaction-history" options={{ title: 'Transaction History' }} />
    <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    <Stack.Screen name="store-information" options={{ title: 'Store Information' }} />
    <Stack.Screen name="payment-methods" options={{ title: 'Payment Methods' }} />
    <Stack.Screen name="scanner-settings" options={{ title: 'Barcode Scanner' }} />
    <Stack.Screen name="appearance" options={{ title: 'Appearance' }} />
    <Stack.Screen name="about" options={{ title: 'About' }} />
    <Stack.Screen name="security" options={{ title: 'Security' }} />
    <Stack.Screen name="change-pin" options={{ title: 'Change Owner PIN' }} />
    <Stack.Screen name="backup-sync" options={{ title: 'Backup & Sync' }} />
    <Stack.Screen name="reset-store" options={{ title: 'Reset Store Completely' }} />
  </GuardedStack></SyncProvider></CloudAuthProvider></AppProvider></AuthProvider></SafeAreaProvider>;
}

function GuardedStack(props: ComponentProps<typeof Stack>) {
  const { user } = useAuth(); const segments = useSegments(); const router = useRouter();
  const routeKey = segments.join('/');
  useEffect(() => {
    const atLogin = routeKey === 'login';
    const atRootIndex = routeKey === '';
    if (!user && !atLogin) router.replace('/login');
    else if (user && (atLogin || atRootIndex)) router.replace('/(tabs)');
  }, [routeKey, router, user]);
  return <Stack {...props} />;
}
