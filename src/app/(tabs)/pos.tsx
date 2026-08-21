import { FilterChips } from '@/components/FilterChips';
import { ProductRow } from '@/components/ProductRow';
import { AppHeader, PrimaryButton, ScreenContainer, SearchBar } from '@/components/ui';
import { colors, spacing, typography } from '@/constants/theme';
import { useAppStore } from '@/store/app';
import { peso } from '@/utils/format';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function PosScreen() {
  const { products, addToCart, cartCount, cartSubtotal } = useAppStore(); const [query, setQuery] = useState(''); const [category, setCategory] = useState('All');
  const categories = ['All', ...Array.from(new Set(products.map((product) => product.category)))];
  const visible = useMemo(() => products.filter((product) => (category === 'All' || product.category === category) && product.name.toLowerCase().includes(query.toLowerCase())), [products, query, category]);
  return <View style={styles.page}><ScreenContainer><AppHeader title="New Sale" subtitle="Search or scan products to begin" /><SearchBar placeholder="Search product or scan barcode" value={query} onChangeText={setQuery} onScan={() => router.push({ pathname: '/barcode-scanner', params: { mode: 'pos' } })} /><FilterChips items={categories} active={category} onChange={setCategory} /><View style={styles.list}>{visible.map((product) => <ProductRow key={product.id} product={product} onAdd={() => addToCart(product.id)} />)}{visible.length === 0 ? <Text style={styles.empty}>No matching products found.</Text> : null}</View></ScreenContainer><View style={styles.cart}><PrimaryButton title={`View Cart (${cartCount})  ·  ${peso(cartSubtotal)}`} icon="cart-outline" onPress={() => router.push('/cart')} /></View></View>;
}
const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, list: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: spacing.md }, cart: { padding: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }, empty: { color: colors.textMuted, fontSize: typography.body, textAlign: 'center', padding: spacing.xxl } });
