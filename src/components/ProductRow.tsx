import { StatusBadge } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { Product } from '@/types';
import { peso } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function ProductRow({ product, mode = 'add', onPress, onAdd }: { product: Product; mode?: 'add' | 'details'; onPress?: () => void; onAdd?: () => void }) {
  const low = product.stock <= 10;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.72 }]}><View style={styles.icon}><Text style={styles.emoji}>{product.icon}</Text></View><View style={styles.info}><Text style={styles.name}>{product.name}</Text><Text style={styles.category}>{product.category}</Text><Text style={styles.price}>{peso(product.price)}</Text></View><View style={styles.end}><StatusBadge label={`Stock: ${product.stock}`} tone={product.stock === 0 ? 'danger' : low ? 'warning' : 'success'} />{mode === 'add' ? <Pressable disabled={product.stock === 0} accessibilityLabel={`Add ${product.name} to cart`} onPress={(event) => { event.stopPropagation(); onAdd?.(); }} style={[styles.add, product.stock === 0 && { backgroundColor: colors.textMuted }]}><Ionicons name="add" size={18} color={colors.white} /></Pressable> : <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}</View></Pressable>;
}
const styles = StyleSheet.create({ row: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm }, icon: { width: 46, height: 54, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' }, emoji: { fontSize: 28 }, info: { flex: 1 }, name: { color: colors.text, fontSize: typography.body, fontWeight: typography.semibold }, category: { color: colors.textMuted, fontSize: typography.caption, marginTop: 2 }, price: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.bold, marginTop: spacing.xs }, end: { alignItems: 'flex-end', gap: spacing.sm }, add: { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' } });
