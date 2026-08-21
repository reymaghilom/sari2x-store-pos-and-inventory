import { colors, radius, spacing, typography } from '@/constants/theme';
import { ScrollView, Pressable, StyleSheet, Text } from 'react-native';
export function FilterChips({ items, active, onChange }: { items: string[]; active: string; onChange: (item: string) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{items.map((item) => <Pressable key={item} onPress={() => onChange(item)} style={[styles.chip, active === item && styles.active]}><Text style={[styles.text, active === item && styles.activeText]}>{item}</Text></Pressable>)}</ScrollView>;
}
const styles = StyleSheet.create({ row: { gap: spacing.sm }, chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill }, active: { backgroundColor: colors.primary, borderColor: colors.primary }, text: { color: colors.textMuted, fontSize: typography.bodySmall, fontWeight: typography.medium }, activeText: { color: colors.white } });
