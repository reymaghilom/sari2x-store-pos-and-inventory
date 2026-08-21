import { colors } from '@/constants/theme';
import { useAndroidImmersiveNavigation } from '@/hooks/useAndroidImmersiveNavigation';
import { AuthProvider } from '@/store/auth';
import { AppProvider } from '@/store/app';
import { SyncProvider } from '@/store/sync';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  useAndroidImmersiveNavigation();
  return <SafeAreaProvider><AuthProvider><AppProvider><SyncProvider><StatusBar style="light" hidden={false} translucent /><Stack screenOptions={{
    headerStyle: { backgroundColor: colors.primary },
    headerTintColor: colors.white,
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
    <Stack.Screen name="payment-success" options={{ title: 'Payment Complete', headerShown: false }} />
    <Stack.Screen name="receipt" options={{ title: 'Receipt' }} />
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
    <Stack.Screen name="users" options={{ title: 'Users & Staff' }} />
    <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    <Stack.Screen name="backup-sync" options={{ title: 'Backup & Sync' }} />
  </Stack></SyncProvider></AppProvider></AuthProvider></SafeAreaProvider>;
}
