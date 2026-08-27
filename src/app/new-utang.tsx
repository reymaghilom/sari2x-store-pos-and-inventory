import { ScreenContainer } from '@/components/ui';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { useAppStore } from '@/store/app';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text } from 'react-native';

/** Existing links land here, but all new Utang is product-backed POS checkout. */
export default function NewUtang() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { customers, beginUtangSale } = useAppStore();
  const customer = customers.find((item) => item.id === id);
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    if (!id) {
      redirected.current = true;
      router.replace({ pathname: '/customers', params: { select: 'new-utang' } });
      return;
    }
    if (!customer || !customer.allowUtang) return;
    redirected.current = true;
    beginUtangSale(id);
    router.replace('/(tabs)/pos');
  }, [beginUtangSale, customer, id]);

  if (customer && !customer.allowUtang) return <PlaceholderScreen title="Utang not allowed" description="This customer is not allowed to create new Utang. Existing balances and payments are unchanged." icon="ban-outline" />;

  return <ScreenContainer style={{ alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /><Text>Opening product selection…</Text></ScreenContainer>;
}
