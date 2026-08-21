import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { HeaderShownContext } from '@react-navigation/elements';
import { PropsWithChildren, ReactNode, useContext } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

export function ScreenContainer({ children, scroll = true, style }: PropsWithChildren<{ scroll?: boolean; style?: StyleProp<ViewStyle> }>) {
  const isNavigationHeaderShown = useContext(HeaderShownContext);
  const edges: Edge[] = isNavigationHeaderShown ? ['left', 'right'] : ['top', 'left', 'right'];
  const content = <View style={[styles.content, style]}>{children}</View>;
  return <SafeAreaView edges={edges} style={styles.safe}>{scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}</SafeAreaView>;
}
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) { return <View style={[styles.card, style]}>{children}</View>; }
export function AppHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.headerTitle}>{title}</Text>{subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}</View>{action}</View>;
}
export function PrimaryButton({ title, onPress, icon, loading, disabled, style }: { title: string; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" disabled={loading || disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, style, disabled && { opacity: 0.45 }, pressed && styles.pressed]}>{loading ? <ActivityIndicator color={colors.white} /> : <>{icon ? <Ionicons name={icon} size={18} color={colors.white} /> : null}<Text style={styles.primaryButtonText}>{title}</Text></>}</Pressable>;
}
export function SecondaryButton({ title, onPress, icon, style }: { title: string; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondaryButton, style, pressed && styles.pressed]}>{icon ? <Ionicons name={icon} size={18} color={colors.primary} /> : null}<Text style={styles.secondaryButtonText}>{title}</Text></Pressable>;
}
export function SearchBar(props: TextInputProps & { onScan?: () => void }) {
  return <View style={styles.search}><Ionicons name="search" size={18} color={colors.textMuted} /><TextInput placeholderTextColor={colors.textMuted} style={styles.searchInput} {...props} />{props.onScan ? <Pressable onPress={props.onScan}><Ionicons name="scan" size={20} color={colors.primary} /></Pressable> : null}</View>;
}
export function StatusBadge({ label, tone = 'success' }: { label: string; tone?: 'success' | 'warning' | 'danger' | 'info' }) {
  const map = { success: [colors.successSoft, colors.success], warning: [colors.warningSoft, colors.warning], danger: [colors.dangerSoft, colors.danger], info: [colors.primarySoft, colors.primary] } as const;
  return <View style={[styles.badge, { backgroundColor: map[tone][0] }]}><Text style={[styles.badgeText, { color: map[tone][1] }]}>{label}</Text></View>;
}
export function StatCard({ label, value, tone = 'blue', footnote }: { label: string; value: string; tone?: 'blue' | 'green' | 'red' | 'orange'; footnote?: string }) {
  const bg = { blue: colors.primarySoft, green: colors.successSoft, red: colors.dangerSoft, orange: colors.warningSoft }[tone];
  return <View style={[styles.stat, { backgroundColor: bg }]}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text>{footnote ? <Text style={styles.statFootnote}>{footnote}</Text> : null}</View>;
}
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={styles.sectionTitle}><Text style={styles.sectionTitleText}>{title}</Text>{action ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, scroll: { paddingBottom: spacing.xxxl }, content: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow },
  header: { backgroundColor: colors.primary, marginHorizontal: -spacing.lg, marginTop: -spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: colors.white, fontSize: typography.title, fontWeight: typography.bold }, headerSubtitle: { color: '#DCE6FF', fontSize: typography.bodySmall, marginTop: spacing.xs },
  primaryButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: colors.white, fontSize: typography.body, fontWeight: typography.semibold }, secondaryButton: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.primary, fontSize: typography.body, fontWeight: typography.semibold }, pressed: { opacity: 0.78 },
  search: { height: 46, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, searchInput: { flex: 1, color: colors.text, fontSize: typography.bodySmall },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, badgeText: { fontSize: typography.caption, fontWeight: typography.semibold },
  stat: { width: '48%', minHeight: 102, borderRadius: radius.md, padding: spacing.md, justifyContent: 'space-between' }, statLabel: { color: colors.textMuted, fontSize: typography.bodySmall, fontWeight: typography.medium }, statValue: { color: colors.text, fontSize: typography.title, fontWeight: typography.bold, marginVertical: spacing.xs }, statFootnote: { color: colors.textMuted, fontSize: typography.caption },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitleText: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold }, sectionAction: { color: colors.primary, fontSize: typography.bodySmall, fontWeight: typography.semibold },
});
export const uiStyles = styles;
