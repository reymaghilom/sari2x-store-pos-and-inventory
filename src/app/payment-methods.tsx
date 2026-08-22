import { createThemedStyles, useAppearance } from '@/store/appearance';
import { PrimaryButton, ScreenContainer } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { defaultPaymentMethods, getPaymentMethodSettings, PaymentMethodSettings, savePaymentMethodSettings } from '@/services/appSettings';
import { PaymentMethod } from '@/types';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Switch, Text, View } from 'react-native';

const methods: { key: PaymentMethod; description: string }[] = [
  { key: 'Cash', description: 'Cash received at checkout' }, { key: 'GCash', description: 'Manual GCash payment confirmation' }, { key: 'Maya', description: 'Manual Maya payment confirmation' }, { key: 'Utang', description: 'Credit for registered customers' },
];
export default function PaymentMethodsScreen() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const [settings, setSettings] = useState<PaymentMethodSettings>(defaultPaymentMethods); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  useEffect(() => { void getPaymentMethodSettings().then(setSettings).finally(() => setLoading(false)); }, []);
  const toggle = (key: PaymentMethod, value: boolean) => { if (!value && Object.entries(settings).filter(([name, enabled]) => name !== key && enabled).length === 0) { Alert.alert('Keep one payment method', 'At least one payment method must remain enabled.'); return; } setSettings((current) => ({ ...current, [key]: value })); };
  const save = async () => { setSaving(true); try { await savePaymentMethodSettings(settings); Alert.alert('Payment methods saved', 'Checkout will now show only the enabled methods.'); } catch { Alert.alert('Not saved', 'Payment methods could not be updated.'); } finally { setSaving(false); } };
  if (loading) return <ScreenContainer style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  return <ScreenContainer><Text style={styles.help}>Choose the payment options available during checkout. These settings do not connect to payment gateways.</Text>{methods.map((method) => <View key={method.key} style={styles.row}><View style={styles.copy}><Text style={styles.title}>{method.key}</Text><Text style={styles.description}>{method.description}</Text></View><Switch value={settings[method.key]} onValueChange={(value) => toggle(method.key, value)} trackColor={{ false: colors.border, true: colors.primary }} /></View>)}<PrimaryButton title="Save Changes" icon="save-outline" loading={saving} onPress={() => void save()} /></ScreenContainer>;
}
const useStyles = createThemedStyles((colors) => ({ loading: { justifyContent: 'center', alignItems: 'center' }, help: { color: colors.textMuted, fontSize: typography.bodySmall, lineHeight: 20 }, row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg }, copy: { flex: 1 }, title: { color: colors.text, fontSize: typography.body, fontWeight: typography.bold }, description: { color: colors.textMuted, fontSize: typography.bodySmall, marginTop: spacing.xs } }));
