import { createThemedStyles, useAppearance } from '@/store/appearance';
import { StatusBadge } from '@/components/ui';
import { ProductImage } from '@/components/ProductImage';
import { radius, spacing, typography } from '@/constants/theme';
import { Product } from '@/types';
import { peso } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

export function ProductRow({ product, mode = 'add', onPress, onAdd }: { product: Product; mode?: 'add' | 'details'; onPress?: () => void; onAdd?: () => void }) {
  const { colors } = useAppearance();
  const styles = useStyles();
  const low = product.stock <= 10;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.72 }]}><ProductImage uri={product.imageUri} fallback={product.icon} size={54} /><View style={styles.info}><Text style={styles.name}>{product.name}</Text><Text style={styles.category}>{product.category}</Text><Text style={styles.price}>{peso(product.price)}</Text></View><View style={styles.end}><StatusBadge label={`Stock: ${product.stock}`} tone={product.stock === 0 ? 'danger' : low ? 'warning' : 'success'} />{mode === 'add' ? <Pressable disabled={product.stock === 0} accessibilityLabel={`Add ${product.name} to cart`} onPress={(event) => { event.stopPropagation(); onAdd?.(); }} style={[styles.add, product.stock === 0 && { backgroundColor: colors.textMuted }]}><Ionicons name="add" size={18} color={colors.primaryText} /></Pressable> : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}</View></Pressable>;
}
const useStyles = createThemedStyles((colors) => ({ row: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm }, info: { flex: 1 }, name: { color: colors.text, fontSize: typography.body, fontWeight: typography.semibold }, category: { color: colors.textMuted, fontSize: typography.caption, marginTop: 2 }, price: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.bold, marginTop: spacing.xs }, end: { alignItems: 'flex-end', gap: spacing.sm }, add: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' } }));
