import { createThemedStyles, useAppearance } from '@/store/appearance';
import { FormField } from '@/components/FormField';
import { PrimaryButton, ScreenContainer } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { useKeyboardAwareForm } from '@/hooks/useKeyboardAwareForm';
import { getStoreInformation, saveStoreInformation } from '@/services/appSettings';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

type Field = 'storeName' | 'ownerName' | 'address' | 'phone';
export default function StoreInformationScreen() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const keyboardForm = useKeyboardAwareForm<Field>(); const [storeName, setStoreName] = useState(''); const [ownerName, setOwnerName] = useState(''); const [address, setAddress] = useState(''); const [phone, setPhone] = useState(''); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { void getStoreInformation().then((value) => { setStoreName(value.storeName); setOwnerName(value.ownerName); setAddress(value.address); setPhone(value.phone); }).catch(() => setError('Store information could not be loaded.')).finally(() => setLoading(false)); }, []);
  const save = async () => { if (!storeName.trim()) { setError('Store Name is required.'); keyboardForm.focusField('storeName'); return; } if (!ownerName.trim()) { setError('Owner Name is required.'); keyboardForm.focusField('ownerName'); return; } setSaving(true); setError(''); try { await saveStoreInformation({ storeName, ownerName, address, phone }); Alert.alert('Store information saved', 'Future screen, PDF, and Bluetooth receipts will use these details.'); } catch { setError('Changes could not be saved. Please try again.'); } finally { setSaving(false); } };
  if (loading) return <ScreenContainer style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  return <ScreenContainer {...keyboardForm.screenProps}><View style={styles.note}><Text style={styles.noteTitle}>Receipt identity</Text><Text style={styles.noteText}>Store name, address, and phone are used on PDF and Bluetooth receipts.</Text></View>{error ? <Text style={styles.error}>{error}</Text> : null}<FormField {...keyboardForm.fieldProps('storeName')} label="Store Name *" value={storeName} onChangeText={setStoreName} placeholder="Sari-sari Store" /><FormField {...keyboardForm.fieldProps('ownerName')} label="Owner Name *" value={ownerName} onChangeText={setOwnerName} placeholder="Owner name" /><FormField {...keyboardForm.fieldProps('address')} label="Address" value={address} onChangeText={setAddress} placeholder="Optional store address" multiline /><FormField {...keyboardForm.fieldProps('phone')} label="Phone Number" value={phone} onChangeText={setPhone} placeholder="Optional phone number" keyboardType="phone-pad" /><PrimaryButton title="Save Changes" icon="save-outline" loading={saving} onPress={() => void save()} /></ScreenContainer>;
}
const useStyles = createThemedStyles((colors) => ({ loading: { justifyContent: 'center', alignItems: 'center' }, note: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder }, noteTitle: { color: colors.text, fontWeight: typography.bold }, noteText: { color: colors.textMuted, fontSize: typography.bodySmall, marginTop: spacing.xs }, error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radius.md } }));
