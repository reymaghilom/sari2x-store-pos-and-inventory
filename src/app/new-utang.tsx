import { ScreenContainer } from '@/components/ui';
import { useAppStore } from '@/store/app';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text } from 'react-native';

/** Existing links land here, but all new Utang is product-backed POS checkout. */
export default function NewUtang() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { customers, beginUtangSale } = useAppStore();
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    if (!id) {
      redirected.current = true;
      router.replace({ pathname: '/customers', params: { select: 'new-utang' } });
      return;
    }
    if (!customers.some((customer) => customer.id === id)) return;
    redirected.current = true;
    beginUtangSale(id);
    router.replace('/(tabs)/pos');
  }, [beginUtangSale, customers, id]);

  return <ScreenContainer style={{ alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /><Text>Opening product selection…</Text></ScreenContainer>;
}
