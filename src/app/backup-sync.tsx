import { Card, PrimaryButton, ScreenContainer, SecondaryButton, StatusBadge } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useRole } from '@/hooks/useRole';
import { SyncStatus } from '@/services/supabase/types';
import { useSync } from '@/store/sync';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

const statusLabel: Record<SyncStatus, string> = { synced: 'Synced', syncing: 'Syncing', offline: 'Offline', pending: 'Pending changes', error: 'Sync error', unconfigured: 'Not configured' };
const statusTone = (status: SyncStatus): 'success' | 'warning' | 'danger' | 'info' => status === 'synced' ? 'success' : status === 'error' ? 'danger' : status === 'syncing' ? 'info' : 'warning';

export default function BackupSyncScreen() {
  const { isAdmin } = useRole(); const sync = useSync(); const [working, setWorking] = useState(false);
  const run = async (retry: boolean) => { setWorking(true); try { const result = retry ? await sync.retryFailed() : await sync.syncNow(); Alert.alert(result.ok ? 'Sync complete' : statusLabel[result.status], result.message); } finally { setWorking(false); } };
  if (!isAdmin) return <ScreenContainer><Card><Text style={styles.title}>Admin access required</Text><Text style={styles.detail}>Backup and sync diagnostics are available to the store administrator.</Text></Card></ScreenContainer>;
  const lastSync = sync.lastSuccessfulSync ? new Date(sync.lastSuccessfulSync).toLocaleString('en-PH') : 'Never';
  return <ScreenContainer>
    <Card style={styles.hero}><View style={styles.icon}><Ionicons name="cloud-done-outline" size={30} color={colors.primary} /></View><View style={styles.heroText}><Text style={styles.title}>Cloud backup</Text><Text style={styles.detail}>{sync.message}</Text></View><StatusBadge label={statusLabel[sync.status]} tone={statusTone(sync.status)} /></Card>
    <Card><Text style={styles.section}>Connection</Text><InfoRow label="Network" value={sync.online ? 'Online' : 'Offline'} /><InfoRow label="Supabase" value={sync.configured ? 'Configured' : 'Not configured'} /><InfoRow label="Last successful sync" value={lastSync} /></Card>
    <Card><Text style={styles.section}>This device</Text><InfoRow label="Device ID" value={sync.deviceId || 'Preparing…'} wrap /><InfoRow label="Pending changes" value={String(sync.pendingCount)} /><InfoRow label="Failed changes" value={String(sync.failedCount)} /></Card>
    <PrimaryButton title="Sync Now" icon="sync-outline" loading={working || sync.status === 'syncing'} disabled={!sync.configured} onPress={() => void run(false)} />
    <SecondaryButton title="Retry Failed Sync" icon="refresh-outline" onPress={() => void run(true)} />
    {!sync.configured ? <View style={styles.notice}><Ionicons name="information-circle-outline" size={20} color={colors.warning} /><Text style={styles.noticeText}>Add the public Supabase URL and publishable key to your Expo environment. The app remains fully usable offline.</Text></View> : null}
  </ScreenContainer>;
}

function InfoRow({ label, value, wrap = false }: { label: string; value: string; wrap?: boolean }) { return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text selectable={wrap} style={[styles.value, wrap && styles.wrap]}>{value}</Text></View>; }
const styles = StyleSheet.create({ hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, icon: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, heroText: { flex: 1 }, title: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold }, detail: { color: colors.textMuted, fontSize: typography.bodySmall, lineHeight: 19, marginTop: spacing.xs }, section: { color: colors.text, fontSize: typography.body, fontWeight: typography.bold, marginBottom: spacing.sm }, row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, label: { color: colors.textMuted, fontSize: typography.bodySmall }, value: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.semibold, textAlign: 'right' }, wrap: { flex: 1, fontSize: typography.caption }, notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.warningSoft, borderRadius: radius.md }, noticeText: { flex: 1, color: colors.textMuted, fontSize: typography.bodySmall, lineHeight: 19 } });
