import { createThemedStyles, useAppearance } from '@/store/appearance';
import { PrimaryButton, ScreenContainer, SecondaryButton } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { useAppStore } from '@/store/app';
import { peso } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Text, View } from 'react-native';

export default function PendingSalesScreen() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const { cart, pendingSales, products, resumePendingSale, deletePendingSale } = useAppStore();
  const resume = async (id: string) => {
    if (cart.length) { Alert.alert('Current cart is not empty', 'Save the current cart for later or complete it before resuming another sale.'); return; }
    try { await resumePendingSale(id); router.replace('/cart'); }
    catch (error) { Alert.alert('Cannot resume sale', error instanceof Error ? error.message : 'The pending sale could not be restored.'); }
  };
  const remove = (id: string) => Alert.alert('Delete pending sale?', 'This removes the saved cart. Inventory will not be changed.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void deletePendingSale(id).catch(() => Alert.alert('Not deleted', 'The pending sale could not be deleted.')) },
  ]);

  return <ScreenContainer>
    <View style={styles.intro}><Ionicons name="time-outline" size={24} color={colors.primary} /><View style={styles.flex}><Text style={styles.title}>Pending Sales</Text><Text style={styles.subtitle}>Saved carts remain here after the app closes.</Text></View></View>
    {pendingSales.map((sale) => {
      const quantity = sale.items.reduce((sum, item) => sum + item.quantity, 0);
      const total = sale.items.reduce((sum, item) => sum + (products.find((product) => product.id === item.productId)?.price ?? 0) * item.quantity, 0) - sale.discount;
      return <View key={sale.id} style={styles.card}><View style={styles.cardTop}><View style={styles.flex}><Text style={styles.saleTitle}>{quantity} {quantity === 1 ? 'item' : 'items'} · {peso(Math.max(0, total))}</Text><Text style={styles.meta}>{new Date(sale.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</Text><Text style={styles.meta}>{sale.customerName ?? 'Walk-in Customer'}</Text></View><Ionicons name="bookmark-outline" size={23} color={colors.primary} /></View><View style={styles.buttons}><SecondaryButton title="Delete" icon="trash-outline" onPress={() => remove(sale.id)} style={styles.flex} /><PrimaryButton title="Resume Sale" icon="play-outline" onPress={() => void resume(sale.id)} style={styles.flex} /></View></View>;
    })}
    {!pendingSales.length ? <View style={styles.empty}><Ionicons name="bookmark-outline" size={50} color={colors.textMuted} /><Text style={styles.emptyTitle}>No pending sales</Text><Text style={styles.subtitle}>Use Save for Later from the cart when a customer wants to continue later.</Text><PrimaryButton title="Start a Sale" icon="cart-outline" onPress={() => router.replace('/(tabs)/pos')} /></View> : null}
  </ScreenContainer>;
}

const useStyles = createThemedStyles((colors) => ({
  intro: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg },
  flex: { flex: 1 }, title: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold }, subtitle: { color: colors.textMuted, fontSize: typography.bodySmall, marginTop: spacing.xs },
  card: { gap: spacing.lg, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg }, cardTop: { flexDirection: 'row', gap: spacing.md }, saleTitle: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold }, meta: { color: colors.textMuted, fontSize: typography.bodySmall, marginTop: spacing.xs }, buttons: { flexDirection: 'row', gap: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl }, emptyTitle: { color: colors.text, fontSize: typography.title, fontWeight: typography.bold },
}));
