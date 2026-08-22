import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Text, View } from 'react-native';

import { FormField } from '@/components/FormField';
import { Card, PrimaryButton, ScreenContainer, SecondaryButton, StatusBadge } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { authenticateOwnerPin, OWNER_PIN_LENGTH } from '@/database/repositories/users';
import { useRole } from '@/hooks/useRole';
import { getAppearancePreference } from '@/services/appSettings';
import { BackupValidationError, createAndShareJsonBackup, getLastManualBackupAt, readAndValidateBackup, restoreBackup, SariStoreBackup } from '@/services/backup';
import { claimExistingCloudBackup, getStoreAdminStatus, replaceAuthenticatedCloudBackup, StoreAdminStatus } from '@/services/supabase/admin';
import { SyncStatus } from '@/services/supabase/types';
import { useAppStore } from '@/store/app';
import { createThemedStyles, useAppearance } from '@/store/appearance';
import { useCloudAuth } from '@/store/cloudAuth';
import { useSync } from '@/store/sync';

const statusLabel: Record<SyncStatus, string> = { synced: 'Up to date', syncing: 'Syncing', offline: 'Offline', pending: 'Pending changes', error: 'Action needed', unconfigured: 'Not configured' };
const statusTone = (status: SyncStatus): 'success' | 'warning' | 'danger' | 'info' => status === 'synced' ? 'success' : status === 'error' ? 'danger' : status === 'syncing' ? 'info' : 'warning';

export default function BackupSyncScreen() {
  const { colors, setPreference } = useAppearance();
  const styles = useStyles();
  const { isAdmin } = useRole();
  const { refreshAll } = useAppStore();
  const sync = useSync();
  const cloudAuth = useCloudAuth();
  const [working, setWorking] = useState<'sync' | 'backup' | 'restore' | null>(null);
  const [candidate, setCandidate] = useState<{ backup: SariStoreBackup; name: string } | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountWorking, setAccountWorking] = useState(false);
  const [adminStatus, setAdminStatus] = useState<StoreAdminStatus | null>(null);
  const [accountMessage, setAccountMessage] = useState('');
  const [cloudPinVisible, setCloudPinVisible] = useState(false);
  const [cloudPin, setCloudPin] = useState('');
  const [cloudPinError, setCloudPinError] = useState('');

  useEffect(() => { void getLastManualBackupAt().then(setLastBackup); }, []);
  useEffect(() => {
    if (!cloudAuth.session) { setAdminStatus(null); return; }
    void getStoreAdminStatus().then(setAdminStatus).catch((error) => setAccountMessage(error instanceof Error ? error.message : 'Cloud account status is unavailable.'));
  }, [cloudAuth.session]);

  const createCloudAccount = async () => {
    if (password.length < 8) { setAccountMessage('Use a password with at least 8 characters.'); return; }
    if (password !== confirmPassword) { setAccountMessage('Passwords do not match.'); return; }
    setAccountWorking(true); setAccountMessage('');
    try { const result = await cloudAuth.signUp(email, password); setAccountMessage(result.message); if (result.ok) { setPassword(''); setConfirmPassword(''); } if (result.ok && !result.needsEmailConfirmation) { await cloudAuth.refreshSession(); setAdminStatus(await getStoreAdminStatus()); await sync.refreshDiagnostics(); } }
    catch (error) { setAccountMessage(error instanceof Error ? error.message : 'Cloud Backup account setup failed.'); }
    finally { setAccountWorking(false); }
  };
  const signInCloudAccount = async () => {
    setAccountWorking(true); setAccountMessage('');
    try { const result = await cloudAuth.signIn(email, password); setAccountMessage(result.message); if (result.ok) { setPassword(''); setConfirmPassword(''); await sync.refreshDiagnostics(); setAdminStatus(await getStoreAdminStatus()); } }
    catch (error) { setAccountMessage(error instanceof Error ? error.message : 'Cloud Backup sign-in failed.'); }
    finally { setAccountWorking(false); }
  };
  const signOutCloudAccount = async () => {
    setAccountWorking(true);
    try { const result = await cloudAuth.signOut(); setAdminStatus(null); setAccountMessage(result.message); await sync.refreshDiagnostics(); }
    finally { setAccountWorking(false); }
  };
  const claimCloudBackup = () => Alert.alert('Claim existing cloud backup?', 'Use this only for the existing store backup that belongs to this Owner account.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Claim Backup', onPress: () => void (async () => { setAccountWorking(true); try { const result = await claimExistingCloudBackup(); setAccountMessage(result.message); setAdminStatus(await getStoreAdminStatus()); await sync.syncNow(); } catch (error) { Alert.alert('Cloud backup not claimed', error instanceof Error ? error.message : 'The claim could not be completed.'); } finally { setAccountWorking(false); } })() },
  ]);

  const runSync = async (retry: boolean) => {
    setWorking('sync');
    try { const result = retry ? await sync.retryFailed() : await sync.syncNow(); Alert.alert(result.ok ? 'Sync complete' : statusLabel[result.status], result.message); }
    finally { setWorking(null); }
  };
  const createBackup = async () => {
    setWorking('backup');
    try { const result = await createAndShareJsonBackup(); setLastBackup(result.backup.created_at); Alert.alert('Backup file created', `${result.fileName} is ready to share or save.`); }
    catch (error) { Alert.alert('Backup not created', error instanceof Error ? error.message : 'The backup file could not be created.'); }
    finally { setWorking(null); }
  };
  const syncRestoredData = () => Alert.alert('Replace cloud backup?', 'The restored data on this phone will replace the current business backup in Supabase.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Continue', onPress: () => { setCloudPin(''); setCloudPinError(''); setCloudPinVisible(true); } },
  ]);
  const authorizeCloudUpdate = async () => {
    const owner = await authenticateOwnerPin(cloudPin);
    if (!owner) { setCloudPin(''); setCloudPinError('Incorrect Owner PIN.'); return; }
    setCloudPinVisible(false); setWorking('sync');
    try { const result = await replaceAuthenticatedCloudBackup(); await sync.refreshDiagnostics(); Alert.alert('Cloud backup updated', result.message || 'Cloud backup updated successfully.'); }
    catch (error) { await sync.refreshDiagnostics(); Alert.alert('Cloud backup not updated', error instanceof Error ? error.message : 'Automatic sync remains paused. Try again.'); }
    finally { setWorking(null); }
  };
  const chooseRestore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/json', 'text/plain'], copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      const backup = await readAndValidateBackup(asset.uri, asset.size);
      setCandidate({ backup, name: asset.name }); setPin(''); setPinError('');
    } catch (error) { Alert.alert('Backup not accepted', error instanceof BackupValidationError ? error.message : 'This is not a valid Sari-sari Store backup file.'); }
  };
  const authorizeRestore = async () => {
    const owner = await authenticateOwnerPin(pin);
    if (!owner) { setPin(''); setPinError('Incorrect Owner PIN.'); return; }
    setPinError('');
    Alert.alert('Restore this backup?', 'Current business data on this phone will be replaced by the selected backup. This cannot be undone unless you have another backup.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore Backup', style: 'destructive', onPress: () => void performRestore() },
    ]);
  };
  const performRestore = async () => {
    if (!candidate) return;
    setCandidate(null); setWorking('restore');
    try {
      await restoreBackup(candidate.backup);
      await refreshAll();
      await setPreference(await getAppearancePreference());
      await sync.refreshDiagnostics();
      Alert.alert('Backup restored', 'Your backup was restored successfully. Update your cloud backup to keep Supabase in sync with this phone.', [
        { text: 'Go to Home', style: 'cancel', onPress: () => router.replace('/(tabs)') },
        { text: 'Update Cloud Backup', onPress: syncRestoredData },
      ]);
    } catch (error) { Alert.alert('Restore failed safely', error instanceof Error ? error.message : 'No local data was changed.'); }
    finally { setWorking(null); }
  };

  if (!isAdmin) return <ScreenContainer><Card><Text style={styles.title}>Owner access required</Text><Text style={styles.detail}>Backup and restore controls are available to the store owner.</Text></Card></ScreenContainer>;
  const lastSync = sync.lastSuccessfulSync ? new Date(sync.lastSuccessfulSync).toLocaleString('en-PH') : 'Never';
  const lastBackupLabel = lastBackup ? new Date(lastBackup).toLocaleString('en-PH') : null;
  const effectiveStatus: SyncStatus = adminStatus?.claimRequired ? 'error' : sync.status;
  const cloudComplete = effectiveStatus === 'synced' && sync.pendingCount === 0 && sync.failedCount === 0 && !sync.restoreNeedsCloudReconciliation;
  return <ScreenContainer keyboardAware>
    <Card><Text style={styles.section}>Cloud Backup Account</Text>{cloudAuth.session ? <><Text style={styles.success}>Connected</Text><InfoRow label="Account" value={cloudAuth.email ?? 'Authenticated Owner'} />{adminStatus?.claimRequired ? <View style={styles.cardActions}><PrimaryButton title="Claim Existing Store Backup" icon="link-outline" loading={accountWorking} onPress={claimCloudBackup} /></View> : null}<View style={styles.cardActions}><SecondaryButton title="Sign Out" icon="log-out-outline" onPress={() => void signOutCloudAccount()} /></View></> : <><Text style={styles.detail}>Cloud Backup needs sign-in.</Text><FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} /><FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" /><FormField label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" /><View style={styles.cardActions}><PrimaryButton title="Create Cloud Backup Account" icon="person-add-outline" loading={accountWorking} disabled={!email.trim() || !password} onPress={() => void createCloudAccount()} /><SecondaryButton title="Sign In to Existing Account" icon="log-in-outline" onPress={() => void signInCloudAccount()} /></View></>}{accountMessage ? <Text style={styles.detail}>{accountMessage}</Text> : null}</Card>
    <Card style={styles.hero}><View style={styles.icon}><Ionicons name="cloud-done-outline" size={30} color={colors.primary} /></View><View style={styles.heroText}><Text style={styles.title}>Cloud Backup</Text><Text style={styles.detail}>Automatically backs up changes to Supabase while the app is open and internet is available. Sales always save on this phone first.</Text></View><StatusBadge label={statusLabel[effectiveStatus]} tone={statusTone(effectiveStatus)} /></Card>
    <Card><Text style={styles.section}>Status</Text><InfoRow label="Connection" value={sync.online ? 'Online' : 'Offline'} /><InfoRow label="Last Successful Sync" value={lastSync} /><InfoRow label="Pending Changes" value={String(sync.pendingCount)} /><InfoRow label="Failed Changes" value={String(sync.failedCount)} />{cloudComplete ? <Text style={styles.success}>Cloud backup is up to date.</Text> : <Text style={styles.detail}>{adminStatus?.claimRequired ? 'Existing cloud backup needs to be claimed by this Owner account.' : sync.message}</Text>}</Card>
    <PrimaryButton title="Sync Now" icon="sync-outline" loading={working === 'sync' || sync.status === 'syncing'} disabled={!sync.configured || !cloudAuth.session || adminStatus?.claimRequired || sync.restoreNeedsCloudReconciliation} onPress={() => void runSync(false)} />
    {sync.failedCount > 0 ? <SecondaryButton title="Retry Failed" icon="refresh-outline" onPress={() => void runSync(true)} /> : null}
    {sync.restoreNeedsCloudReconciliation ? <PrimaryButton title="Update Cloud Backup" icon="cloud-upload-outline" loading={working === 'sync'} disabled={!sync.configured || !cloudAuth.session || !sync.online} onPress={syncRestoredData} /> : null}
    {sync.restoreNeedsCloudReconciliation ? <View style={styles.dangerNotice}><Ionicons name="shield-outline" size={20} color={colors.danger} /><Text style={styles.noticeText}>Your backup was restored on this phone. Update your cloud backup before automatic sync resumes.</Text></View> : null}
    {!sync.configured ? <View style={styles.notice}><Ionicons name="information-circle-outline" size={20} color={colors.warning} /><Text style={styles.noticeText}>Cloud backup is not configured. The app remains fully usable offline.</Text></View> : null}

    <Card><Text style={styles.section}>Backup & Restore</Text><Text style={styles.detail}>Create a portable backup file that you can save to Drive, another phone, a PC, or USB storage. Restore a backup file to replace the business data on this phone after Owner PIN confirmation.</Text><Text style={styles.detail}>{lastBackupLabel ? `Last Backup: ${lastBackupLabel}` : 'No backup file created yet.'}</Text><View style={styles.cardActions}><PrimaryButton title="Create Backup File" icon="download-outline" loading={working === 'backup'} disabled={Boolean(working)} onPress={() => void createBackup()} /><SecondaryButton title="Restore Backup File" icon="document-outline" onPress={() => void chooseRestore()} /></View></Card>
    <View style={styles.notice}><Ionicons name="image-outline" size={20} color={colors.warning} /><Text style={styles.noticeText}>Product photos stored only on this phone are not included in backup files.</Text></View>

    <Modal visible={Boolean(candidate)} transparent animationType="fade" onRequestClose={() => setCandidate(null)}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.title}>Confirm Owner PIN</Text><Text style={styles.detail}>Enter the current PIN on this phone before restoring {candidate?.name}.</Text><FormField label="Owner PIN" value={pin} onChangeText={(value) => { setPin(value.replace(/\D/g, '').slice(0, OWNER_PIN_LENGTH)); setPinError(''); }} keyboardType="number-pad" secureTextEntry maxLength={OWNER_PIN_LENGTH} error={pinError || undefined} /><View style={styles.modalActions}><SecondaryButton title="Cancel" onPress={() => setCandidate(null)} style={styles.flex} /><PrimaryButton title="Continue" disabled={pin.length !== OWNER_PIN_LENGTH} onPress={() => void authorizeRestore()} style={styles.flex} /></View></View></View>
    </Modal>
    <Modal visible={cloudPinVisible} transparent animationType="fade" onRequestClose={() => setCloudPinVisible(false)}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.title}>Confirm Owner PIN</Text><Text style={styles.detail}>Enter the current PIN before replacing your cloud backup.</Text><FormField label="Owner PIN" value={cloudPin} onChangeText={(value) => { setCloudPin(value.replace(/\D/g, '').slice(0, OWNER_PIN_LENGTH)); setCloudPinError(''); }} keyboardType="number-pad" secureTextEntry maxLength={OWNER_PIN_LENGTH} error={cloudPinError || undefined} /><View style={styles.modalActions}><SecondaryButton title="Cancel" onPress={() => setCloudPinVisible(false)} style={styles.flex} /><PrimaryButton title="Update Cloud Backup" disabled={cloudPin.length !== OWNER_PIN_LENGTH} onPress={() => void authorizeCloudUpdate()} style={styles.flex} /></View></View></View>
    </Modal>
    {working === 'restore' ? <View style={styles.restoreOverlay}><Text style={styles.title}>Restoring backup…</Text><Text style={styles.detail}>Keep the app open. Existing data remains safe unless the full transaction succeeds.</Text></View> : null}
  </ScreenContainer>;
}

function InfoRow({ label, value }: { label: string; value: string }) { const styles = useStyles(); return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>; }
const useStyles = createThemedStyles((colors) => ({
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, icon: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, heroText: { flex: 1 }, title: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold }, detail: { color: colors.textMuted, fontSize: typography.bodySmall, lineHeight: 19, marginTop: spacing.xs }, section: { color: colors.text, fontSize: typography.body, fontWeight: typography.bold, marginBottom: spacing.sm }, row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }, label: { color: colors.textMuted, fontSize: typography.bodySmall }, value: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.semibold, textAlign: 'right' }, success: { color: colors.success, fontWeight: typography.semibold, marginTop: spacing.md }, notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.warningSoft, borderRadius: radius.md }, dangerNotice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.dangerSoft, borderRadius: radius.md }, noticeText: { flex: 1, color: colors.textMuted, fontSize: typography.bodySmall, lineHeight: 19 }, cardActions: { gap: spacing.sm, marginTop: spacing.lg }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: spacing.lg }, modalCard: { gap: spacing.lg, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border }, modalActions: { flexDirection: 'row', gap: spacing.sm }, flex: { flex: 1 }, restoreOverlay: { padding: spacing.lg, backgroundColor: colors.primarySoft, borderRadius: radius.lg },
}));
