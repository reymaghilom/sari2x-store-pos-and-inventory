import { createThemedStyles } from '@/store/appearance';
import { FilterChips } from '@/components/FilterChips';
import { ProductRow } from '@/components/ProductRow';
import { AppHeader, PrimaryButton, ScreenContainer, SearchBar, SecondaryButton } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { useAppStore } from '@/store/app';
import { peso } from '@/utils/format';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';

export default function PosScreen() {  const styles = useStyles();
  const { products, addToCart, cartCount, cartSubtotal, pendingSales, customers, utangSaleCustomerId, cancelUtangSale } = useAppStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const categories = ['All', ...Array.from(new Set(products.map((product) => product.category)))];
  const visible = useMemo(() => products.filter((product) => (category === 'All' || product.category === category) && product.name.toLowerCase().includes(query.toLowerCase())), [products, query, category]);
  const utangCustomer = customers.find((customer) => customer.id === utangSaleCustomerId);
  useFocusEffect(useCallback(() => { if (!utangSaleCustomerId) return undefined; const subscription = BackHandler.addEventListener('hardwareBackPress', () => { cancelUtangSale(); router.back(); return true; }); return () => subscription.remove(); }, [cancelUtangSale, utangSaleCustomerId]));

  return (
    <View style={styles.page}>
      <ScreenContainer>
        <AppHeader title={utangCustomer ? `New Utang for ${utangCustomer.name}` : 'New Sale'} subtitle={utangCustomer ? 'Add the products this customer is buying' : 'Search or scan products to begin'} />
        {utangCustomer ? <View style={styles.intent}><View style={styles.intentText}><Text style={styles.intentTitle}>Customer: {utangCustomer.name}</Text><Text style={styles.intentMeta}>Remaining credit: {peso(utangCustomer.remainingCredit)}</Text></View><SecondaryButton title="Change Customer" onPress={() => router.push({ pathname: '/customers', params: { select: 'utang-sale' } })} /><SecondaryButton title="Cancel" onPress={cancelUtangSale} /></View> : null}
        {pendingSales.length ? <PrimaryButton title={`Pending Sales (${pendingSales.length})`} icon="time-outline" onPress={() => router.push('/pending-sales' as never)} /> : null}
        <SearchBar placeholder="Search product or scan barcode" value={query} onChangeText={setQuery} onScan={() => router.push({ pathname: '/barcode-scanner', params: { mode: 'pos' } })} />
        <FilterChips items={categories} active={category} onChange={setCategory} />
        <View style={styles.list}>
          {visible.map((product) => <ProductRow key={product.id} product={product} onAdd={() => addToCart(product.id)} />)}
          {visible.length === 0 ? <Text style={styles.empty}>No matching products found.</Text> : null}
        </View>
      </ScreenContainer>
      <View style={styles.cart}><PrimaryButton title={`View Cart (${cartCount}) · ${peso(cartSubtotal)}`} icon="cart-outline" onPress={() => router.push('/cart')} /></View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  page: { flex: 1, backgroundColor: colors.background },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  cart: { padding: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  empty: { color: colors.textMuted, fontSize: typography.body, textAlign: 'center', padding: spacing.xxl },
  intent: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.warningSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.warning },
  intentText: { gap: spacing.xs },
  intentTitle: { color: colors.text, fontWeight: typography.bold },
  intentMeta: { color: colors.textMuted, fontSize: typography.bodySmall },
}));
