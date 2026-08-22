import { createThemedStyles } from '@/store/appearance';
import { FormField } from '@/components/FormField';
import { PrimaryButton, ScreenContainer } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { changeOwnerPin, isValidOwnerPin, OWNER_PIN_LENGTH } from '@/database/repositories/users';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

export default function ChangePinScreen() {  const styles = useStyles();
  const [current, setCurrent] = useState(''); const [next, setNext] = useState(''); const [confirm, setConfirm] = useState(''); const [saving, setSaving] = useState(false);
  const valid = isValidOwnerPin(current) && isValidOwnerPin(next) && isValidOwnerPin(confirm) && next === confirm && next !== current;
  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try { await changeOwnerPin(current, next); Alert.alert('PIN changed', 'Your new Owner PIN is active on this device.', [{ text: 'Done', onPress: () => router.back() }]); }
    catch (error) { Alert.alert('PIN not changed', error instanceof Error ? error.message : 'Check the current PIN and try again.'); }
    finally { setSaving(false); }
  };
  const input = { keyboardType: 'number-pad' as const, secureTextEntry: true, maxLength: OWNER_PIN_LENGTH };
  const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, OWNER_PIN_LENGTH);
  return <ScreenContainer><View style={styles.intro}><Text style={styles.title}>Choose a private PIN</Text><Text style={styles.detail}>Use exactly 4 digits. The PIN is hashed and stored only in this app&apos;s local database.</Text></View><View style={styles.form}><FormField label="Current PIN" value={current} onChangeText={(value) => setCurrent(digitsOnly(value))} {...input} /><FormField label="New PIN" value={next} onChangeText={(value) => setNext(digitsOnly(value))} {...input} /><FormField label="Confirm new PIN" value={confirm} onChangeText={(value) => setConfirm(digitsOnly(value))} {...input} />{confirm && confirm !== next ? <Text style={styles.error}>New PINs do not match.</Text> : null}{next && next === current ? <Text style={styles.error}>Choose a different PIN.</Text> : null}<PrimaryButton title="Save New PIN" icon="checkmark-circle-outline" loading={saving} disabled={!valid} onPress={() => void save()} /></View></ScreenContainer>;
}
const useStyles = createThemedStyles((colors) => ({ intro: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.primarySoft }, title: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold }, detail: { color: colors.textMuted, fontSize: typography.bodySmall, lineHeight: 20, marginTop: spacing.xs }, form: { gap: spacing.lg }, error: { color: colors.danger, fontSize: typography.bodySmall } }));
