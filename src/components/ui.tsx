import { createThemedStyles, useAppearance } from '@/store/appearance';
import { radius, shadow, spacing, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { HeaderShownContext } from '@react-navigation/elements';
import { PropsWithChildren, ReactNode, Ref, useContext } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleProp, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

type ScreenContainerProps = PropsWithChildren<{
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  keyboardAware?: boolean;
  scrollRef?: Ref<ScrollView>;
  scrollBottomInset?: number;
  onScrollViewLayout?: (event: LayoutChangeEvent) => void;
  onScrollViewScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}>;

export function ScreenContainer({ children, scroll = true, style, keyboardAware = false, scrollRef, scrollBottomInset = 0, onScrollViewLayout, onScrollViewScroll }: ScreenContainerProps) {  const styles = useStyles();
  const isNavigationHeaderShown = useContext(HeaderShownContext);
  const edges: Edge[] = isNavigationHeaderShown ? ['left', 'right'] : ['top', 'left', 'right'];
  const content = <View style={[styles.content, style]}>{children}</View>;
  if (!scroll) return <SafeAreaView edges={edges} style={styles.safe}>{content}</SafeAreaView>;
  const scroller = (
    <ScrollView
      ref={scrollRef}
      automaticallyAdjustKeyboardInsets={keyboardAware && Platform.OS === 'ios'}
      keyboardDismissMode={keyboardAware ? 'none' : Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      onLayout={onScrollViewLayout}
      onScroll={onScrollViewScroll}
      scrollEventThrottle={onScrollViewScroll ? 16 : undefined}
      contentContainerStyle={[styles.scroll, scrollBottomInset > 0 && { paddingBottom: spacing.xxxl + scrollBottomInset }]}
    >
      {content}
    </ScrollView>
  );
  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      {keyboardAware ? <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>{scroller}</KeyboardAvoidingView> : scroller}
    </SafeAreaView>
  );
}
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {  const styles = useStyles(); return <View style={[styles.card, style]}>{children}</View>; }
export function AppHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {  const styles = useStyles();
  return <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.headerTitle}>{title}</Text>{subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}</View>{action}</View>;
}
export function PrimaryButton({ title, onPress, icon, loading, disabled, style }: { title: string; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppearance();
  const styles = useStyles();
  return <Pressable accessibilityRole="button" disabled={loading || disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, style, disabled && { opacity: 0.45 }, pressed && styles.pressed]}>{loading ? <ActivityIndicator color={colors.primaryText} /> : <>{icon ? <Ionicons name={icon} size={18} color={colors.primaryText} /> : null}<Text style={styles.primaryButtonText}>{title}</Text></>}</Pressable>;
}
export function SecondaryButton({ title, onPress, icon, style }: { title: string; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppearance();
  const styles = useStyles();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondaryButton, style, pressed && styles.pressed]}>{icon ? <Ionicons name={icon} size={18} color={colors.primary} /> : null}<Text style={styles.secondaryButtonText}>{title}</Text></Pressable>;
}
export function SearchBar({ onScan, placeholderTextColor, ...props }: TextInputProps & { onScan?: () => void }) {
  const { colors } = useAppearance();
  const styles = useStyles();
  return <View style={styles.search}><Ionicons name="search" size={18} color={colors.textMuted} /><TextInput {...props} placeholderTextColor={placeholderTextColor ?? colors.textMuted} style={[styles.searchInput, props.style]} />{onScan ? <Pressable onPress={onScan}><Ionicons name="scan" size={20} color={colors.primary} /></Pressable> : null}</View>;
}
export function StatusBadge({ label, tone = 'success' }: { label: string; tone?: 'success' | 'warning' | 'danger' | 'info' }) {
  const { colors } = useAppearance();
  const styles = useStyles();
  const map = { success: [colors.successSoft, colors.success], warning: [colors.warningSoft, colors.warning], danger: [colors.dangerSoft, colors.danger], info: [colors.primarySoft, colors.primary] } as const;
  return <View style={[styles.badge, { backgroundColor: map[tone][0] }]}><Text style={[styles.badgeText, { color: map[tone][1] }]}>{label}</Text></View>;
}
export function StatCard({ label, value, tone = 'blue', footnote, icon }: { label: string; value: string; tone?: 'blue' | 'green' | 'red' | 'orange' | 'neutral'; footnote?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useAppearance();
  const styles = useStyles();
  const palette = {
    blue: { background: colors.primarySoft, border: colors.primaryBorder, accent: colors.primary },
    green: { background: colors.successSoft, border: colors.successBorder, accent: colors.success },
    red: { background: colors.dangerSoft, border: colors.dangerBorder, accent: colors.danger },
    orange: { background: colors.warningSoft, border: colors.warningBorder, accent: colors.warning },
    neutral: { background: colors.surface, border: colors.border, accent: colors.textMuted },
  }[tone];
  return <View style={[styles.stat, { backgroundColor: palette.background, borderColor: palette.border }]}><View style={styles.statTop}><Text style={styles.statLabel}>{label}</Text>{icon ? <View style={[styles.statIcon, { backgroundColor: colors.surface }]}><Ionicons name={icon} size={17} color={palette.accent} /></View> : null}</View><Text style={styles.statValue}>{value}</Text>{footnote ? <Text style={styles.statFootnote}>{footnote}</Text> : null}</View>;
}
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {  const styles = useStyles();
  return <View style={styles.sectionTitle}><Text style={styles.sectionTitleText}>{title}</Text>{action ? <Pressable onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}
const useStyles = createThemedStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.background }, keyboard: { flex: 1 }, scroll: { paddingBottom: spacing.xxxl }, content: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadow },
  header: { backgroundColor: colors.primary, marginHorizontal: -spacing.lg, marginTop: -spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: colors.primaryText, fontSize: typography.title, fontWeight: typography.bold }, headerSubtitle: { color: colors.primaryText, fontSize: typography.bodySmall, marginTop: spacing.xs },
  primaryButton: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: colors.primaryText, fontSize: typography.body, fontWeight: typography.semibold }, secondaryButton: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.primary, fontSize: typography.body, fontWeight: typography.semibold }, pressed: { opacity: 0.78 },
  search: { height: 46, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, searchInput: { flex: 1, color: colors.text, fontSize: typography.bodySmall },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, badgeText: { fontSize: typography.caption, fontWeight: typography.semibold },
  stat: { width: '48%', minHeight: 112, borderRadius: radius.lg, padding: spacing.md, justifyContent: 'space-between', borderWidth: 1, ...shadow }, statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }, statIcon: { width: 32, height: 32, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }, statLabel: { flex: 1, color: colors.textSecondary, fontSize: typography.bodySmall, fontWeight: typography.medium }, statValue: { color: colors.textPrimary, fontSize: typography.title, fontWeight: typography.bold, marginVertical: spacing.xs }, statFootnote: { color: colors.textSecondary, fontSize: typography.caption },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitleText: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold }, sectionAction: { color: colors.primary, fontSize: typography.bodySmall, fontWeight: typography.semibold },
}));
