import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { FormField } from '@/components/FormField';
import { Card, PrimaryButton, ScreenContainer, SecondaryButton } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { authenticateOwnerPin, OWNER_PIN_LENGTH } from '@/database/repositories/users';
import { useRole } from '@/hooks/useRole';
import { createAndShareJsonBackup } from '@/services/backup';
import { resetLocalStoreCompletely } from '@/services/storeReset';
import { resetAuthenticatedCloudStore } from '@/services/supabase/admin';
import { useAppStore } from '@/store/app';
import { createThemedStyles, useAppearance } from '@/store/appearance';
import { useCloudAuth } from '@/store/cloudAuth';
import { useSync } from '@/store/sync';

type ConfirmationStep = 'pin' | 'reset' | null;

export default function ResetStoreScreen() {
  const { colors, setPreference } = useAppearance();
  const styles = useStyles();
  const { isAdmin } = useRole();
  const { resetAfterStoreReset } = useAppStore();
  const sync = useSync();
  const cloudAuth = useCloudAuth();
  const [step, setStep] = useState<ConfirmationStep>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [working, setWorking] = useState(false);

  const closeConfirmation = () => { if (!working) { setStep(null); setPin(''); setPinError(''); setConfirmation(''); } };
  const requestPin = () => { setPin(''); setPinError(''); setConfirmation(''); setStep('pin'); };

  const offerBackup = () => Alert.alert('Create a backup first?', 'Creating a backup file is recommended before permanently removing store data.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Continue Without Backup', style: 'destructive', onPress: requestPin },
    { text: 'Create Backup First', onPress: () => void createBackupFirst() },
  ]);

  const beginReset = () => {
    if (cloudAuth.configured && !cloudAuth.session) {
      Alert.alert('Cloud Backup needs sign-in', 'Sign in to the Cloud Backup account before resetting the store. Store data was not changed.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Cloud Backup', onPress: () => router.push('/backup-sync') },
      ]);
      return;
    }
    Alert.alert(
      'Reset Store Completely?',
      'This will permanently remove all products, inventory, sales, customers, Utang, payments, reports, and other store data from this phone and your cloud backup.\n\nYour Owner PIN will be kept.\n\nThis action cannot be undone unless you have a backup file.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', style: 'destructive', onPress: offerBackup }],
    );
  };

  const createBackupFirst = async () => {
    setWorking(true);
    try {
      const result = await createAndShareJsonBackup();
      Alert.alert('Backup file created', `${result.fileName} is ready to share or save.`, [{ text: 'Continue', onPress: requestPin }]);
    } catch (error) {
      Alert.alert('Backup failed', `${error instanceof Error ? error.message : 'The backup file could not be created.'}\n\nStore data was not reset.`);
    } finally { setWorking(false); }
  };

  const verifyPin = async () => {
    const owner = await authenticateOwnerPin(pin);
    if (!owner) {
      setPin(''); setPinError('Incorrect PIN. Store data was not reset.');
      Alert.alert('Incorrect PIN', 'Incorrect PIN. Store data was not reset.');
      return;
    }
    setPinError(''); setConfirmation(''); setStep('reset');
  };

  const performReset = async () => {
    if (confirmation !== 'RESET') return;
    setWorking(true);
    let localResetCommitted = false;
    try {
      if (cloudAuth.configured) await resetAuthenticatedCloudStore();
      const result = await resetLocalStoreCompletely(cloudAuth.configured);
      localResetCommitted = true;
      await resetAfterStoreReset();
      await setPreference('system');
      await sync.refreshDiagnostics();
      setStep(null);
      const message = result.failedProductImages
        ? `Store reset completed. ${result.failedProductImages} product photo${result.failedProductImages === 1 ? '' : 's'} could not be removed from this phone.`
        : 'Store reset completed.';
      Alert.alert('Store reset completed', message, [{ text: 'Go to Home', onPress: () => router.replace('/(tabs)') }]);
    } catch {
      Alert.alert(
        localResetCommitted ? 'Store reset completed' : 'Store reset could not be completed',
        localResetCommitted
          ? 'Store data was reset, but the app could not refresh the screen. Restart the app to continue.'
          : 'Store reset could not be completed. Your data was not changed.',
      );
    } finally { setWorking(false); }
  };

  if (!isAdmin) return <ScreenContainer><Card><Text style={styles.title}>Owner access required</Text><Text style={styles.body}>Only the Owner can reset store data.</Text></Card></ScreenContainer>;

  return <ScreenContainer keyboardAware>
    <Card style={styles.warningCard}>
      <View style={styles.icon}><Ionicons name="warning-outline" size={28} color={colors.danger} /></View>
      <Text style={styles.title}>Reset Store Completely</Text>
      <Text style={styles.body}>Remove all store data from this phone and cloud backup. Your Owner PIN will be kept.</Text>
      <Text style={styles.warning}>This action permanently removes business records and cannot be undone unless you have a backup file.</Text>
    </Card>

    {cloudAuth.configured && !cloudAuth.session ? <View style={styles.cloudBlock}><Ionicons name="shield-outline" size={20} color={colors.warning} /><Text style={styles.cloudBlockText}>Cloud Backup needs sign-in. Reset is blocked so old cloud records cannot return to this phone.</Text></View> : null}

    <Pressable accessibilityRole="button" disabled={working} onPress={beginReset} style={({ pressed }) => [styles.destructiveButton, working && styles.disabled, pressed && styles.pressed]}>
      <Ionicons name="trash-outline" size={19} color={colors.primaryText} />
      <Text style={styles.destructiveButtonText}>Reset Store Completely</Text>
    </Pressable>

    <Modal visible={step !== null} transparent animationType="fade" onRequestClose={closeConfirmation}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}>
        {step === 'pin' ? <>
          <Text style={styles.title}>Confirm Owner PIN</Text>
          <Text style={styles.body}>Enter the current 4-digit Owner PIN. No data changes until all confirmations are complete.</Text>
          <FormField label="Owner PIN" value={pin} onChangeText={(value) => { setPin(value.replace(/\D/g, '').slice(0, OWNER_PIN_LENGTH)); setPinError(''); }} keyboardType="number-pad" secureTextEntry maxLength={OWNER_PIN_LENGTH} error={pinError || undefined} />
          <View style={styles.actions}><SecondaryButton title="Cancel" onPress={closeConfirmation} style={styles.flex} /><PrimaryButton title="Continue" disabled={pin.length !== OWNER_PIN_LENGTH} onPress={() => void verifyPin()} style={styles.flex} /></View>
        </> : <>
          <Text style={styles.title}>Final Confirmation</Text>
          <Text style={styles.body}>Type RESET to confirm.</Text>
          <TextInput accessibilityLabel="Type RESET to confirm" autoCapitalize="characters" autoCorrect={false} editable={!working} value={confirmation} onChangeText={setConfirmation} placeholder="RESET" placeholderTextColor={colors.textMuted} style={styles.confirmInput} />
          <View style={styles.actions}><SecondaryButton title="Cancel" onPress={closeConfirmation} style={styles.flex} /><Pressable accessibilityRole="button" disabled={confirmation !== 'RESET' || working} onPress={() => void performReset()} style={({ pressed }) => [styles.finalButton, (confirmation !== 'RESET' || working) && styles.disabled, pressed && styles.pressed]}><Text style={styles.finalButtonText}>{working ? 'Resetting…' : 'Reset Store Completely'}</Text></Pressable></View>
        </>}
      </View></View>
    </Modal>
  </ScreenContainer>;
}

const useStyles = createThemedStyles((colors) => ({
  warningCard: { alignItems: 'center', borderColor: colors.dangerBorder },
  icon: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerSoft, marginBottom: spacing.md },
  title: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold, textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: typography.bodySmall, lineHeight: 20, textAlign: 'center', marginTop: spacing.sm },
  warning: { color: colors.danger, fontSize: typography.bodySmall, fontWeight: typography.semibold, lineHeight: 20, textAlign: 'center', marginTop: spacing.md },
  cloudBlock: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft },
  cloudBlockText: { flex: 1, color: colors.textMuted, fontSize: typography.bodySmall, lineHeight: 19 },
  destructiveButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.danger },
  destructiveButtonText: { color: colors.primaryText, fontSize: typography.body, fontWeight: typography.bold },
  pressed: { opacity: 0.75 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalCard: { gap: spacing.lg, padding: spacing.xl, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  confirmInput: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface, color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold, letterSpacing: 2, textAlign: 'center' },
  finalButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.danger },
  finalButtonText: { color: colors.primaryText, fontSize: typography.bodySmall, fontWeight: typography.bold, textAlign: 'center' },
  disabled: { opacity: 0.4 },
}));
