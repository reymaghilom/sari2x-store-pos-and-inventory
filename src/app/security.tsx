import { createThemedStyles, useAppearance } from '@/store/appearance';
import { Card, ScreenContainer } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { getLocalSetting, setLocalSetting } from '@/database/repositories/settings';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const timeouts = [{ label: 'Immediately', value: '0' }, { label: 'After 1 minute', value: '60000' }, { label: 'After 5 minutes', value: '300000' }, { label: 'After 15 minutes', value: '900000' }, { label: 'Never', value: '-1' }];
export default function SecurityScreen() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const [timeout, setTimeoutValue] = useState('300000');
  const [needsChange, setNeedsChange] = useState(false);
  useFocusEffect(useCallback(() => { void Promise.all([getLocalSetting('security_lock_timeout_ms'), getLocalSetting('owner_pin_needs_change')]).then(([stored, pending]) => { if (stored) setTimeoutValue(stored); setNeedsChange(pending === '1'); }); }, []));
  const choose = async (value: string) => { setTimeoutValue(value); await setLocalSetting('security_lock_timeout_ms', value); };
  return <ScreenContainer>
    {needsChange ? <View style={styles.notice}><Ionicons name="warning-outline" size={21} color={colors.warning} /><Text style={styles.noticeText}>Change the temporary Owner PIN before regular use.</Text></View> : null}
    <Card><Pressable style={styles.change} onPress={() => router.push('/change-pin' as never)}><View style={styles.icon}><Ionicons name="key-outline" size={21} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.title}>Change Owner PIN</Text><Text style={styles.detail}>Use a private 4-digit PIN.</Text></View><Ionicons name="chevron-forward" size={18} color={colors.textMuted} /></Pressable></Card>
    <View><Text style={styles.heading}>Lock after leaving the app</Text><Text style={styles.help}>The cart and unsaved checkout state remain available after you unlock again.</Text></View>
    <Card style={{ paddingVertical: 0 }}>{timeouts.map((item) => <Pressable key={item.value} onPress={() => void choose(item.value)} style={styles.option}><Text style={styles.title}>{item.label}</Text><Ionicons name={timeout === item.value ? 'radio-button-on' : 'radio-button-off'} size={22} color={timeout === item.value ? colors.primary : colors.textMuted} /></Pressable>)}</Card>
  </ScreenContainer>;
}
const useStyles = createThemedStyles((colors) => ({ notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft }, noticeText: { flex: 1, color: colors.text, fontSize: typography.bodySmall, lineHeight: 20 }, change: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, icon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, title: { color: colors.text, fontSize: typography.body, fontWeight: typography.semibold }, detail: { color: colors.textMuted, fontSize: typography.bodySmall, marginTop: 3 }, heading: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold }, help: { color: colors.textMuted, fontSize: typography.bodySmall, marginTop: spacing.xs, lineHeight: 19 }, option: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border } }));
