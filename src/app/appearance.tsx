import { ScreenContainer } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { AppearancePreference } from '@/services/appSettings';
import { useAppearance, createThemedStyles } from '@/store/appearance';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, Text, View } from 'react-native';

const options: { value: AppearancePreference; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'light', label: 'Light', description: 'Always use the light appearance.', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', description: 'Always use the dark appearance.', icon: 'moon-outline' },
  { value: 'system', label: 'Use Device Setting', description: 'Follow this phone’s light or dark setting.', icon: 'phone-portrait-outline' },
];
export default function AppearanceScreen() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const { preference, setPreference } = useAppearance();
  const choose = async (value: AppearancePreference) => { try { await setPreference(value); } catch { Alert.alert('Appearance not saved', 'The preference could not be saved.'); } };
  return <ScreenContainer><Text style={styles.help}>Choose how Sari-sari Store looks on this phone.</Text>{options.map((option) => { const selected = preference === option.value; return <Pressable key={option.value} onPress={() => void choose(option.value)} style={({ pressed }) => [styles.row, selected && styles.selected, pressed && styles.pressed]}><View style={[styles.icon, selected && styles.iconSelected]}><Ionicons name={option.icon} size={22} color={selected ? colors.white : colors.primary} /></View><View style={styles.copy}><Text style={styles.title}>{option.label}</Text><Text style={styles.description}>{option.description}</Text></View><Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.textMuted} /></Pressable>; })}</ScreenContainer>;
}
const useStyles = createThemedStyles((colors) => ({ help: { color: colors.textMuted, fontSize: typography.bodySmall }, row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg }, selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, pressed: { opacity: 0.76 }, icon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }, iconSelected: { backgroundColor: colors.primary }, copy: { flex: 1 }, title: { color: colors.text, fontWeight: typography.bold }, description: { color: colors.textMuted, fontSize: typography.bodySmall, marginTop: spacing.xs } }));
