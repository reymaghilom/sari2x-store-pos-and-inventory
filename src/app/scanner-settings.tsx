import { createThemedStyles, useAppearance } from '@/store/appearance';
import { PrimaryButton, ScreenContainer } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { defaultScannerPreferences, getScannerPreferences, saveScannerPreferences, ScannerPreferences } from '@/services/appSettings';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Switch, Text, View } from 'react-native';

const options: { key: keyof ScannerPreferences; label: string; description: string }[] = [
  { key: 'sound', label: 'Sound after successful scan', description: 'Play a short confirmation tone when a barcode is accepted.' },
  { key: 'vibrate', label: 'Vibrate after successful scan', description: 'Give brief physical feedback when a barcode is accepted.' },
  { key: 'torchDefault', label: 'Torch on by default', description: 'Start the scanner flashlight automatically.' },
  { key: 'autoAdd', label: 'Auto-add to cart', description: 'Immediately add a found product in POS scanner mode.' },
];
export default function ScannerSettingsScreen() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const [settings, setSettings] = useState<ScannerPreferences>(defaultScannerPreferences); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  useEffect(() => { void getScannerPreferences().then(setSettings).finally(() => setLoading(false)); }, []);
  const save = async () => { setSaving(true); try { await saveScannerPreferences(settings); Alert.alert('Scanner settings saved', 'The barcode scanner will use these preferences the next time it opens.'); } catch { Alert.alert('Not saved', 'Scanner settings could not be updated.'); } finally { setSaving(false); } };
  if (loading) return <ScreenContainer style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  return <ScreenContainer><Text style={styles.help}>These preferences affect successful scans on this phone.</Text>{options.map((option) => <View key={option.key} style={styles.row}><View style={styles.copy}><Text style={styles.title}>{option.label}</Text><Text style={styles.description}>{option.description}</Text></View><Switch value={settings[option.key]} onValueChange={(value) => setSettings((current) => ({ ...current, [option.key]: value }))} trackColor={{ false: colors.border, true: colors.primary }} /></View>)}<PrimaryButton title="Save Changes" icon="save-outline" loading={saving} onPress={() => void save()} /></ScreenContainer>;
}
const useStyles = createThemedStyles((colors) => ({ loading: { justifyContent: 'center', alignItems: 'center' }, help: { color: colors.textMuted, fontSize: typography.bodySmall }, row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg }, copy: { flex: 1 }, title: { color: colors.text, fontWeight: typography.bold }, description: { color: colors.textMuted, fontSize: typography.bodySmall, lineHeight: 19, marginTop: spacing.xs } }));
