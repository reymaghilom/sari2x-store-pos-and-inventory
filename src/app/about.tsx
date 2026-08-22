import { createThemedStyles, useAppearance } from '@/store/appearance';
import { Card, ScreenContainer } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Text, View } from 'react-native';

export default function AboutScreen() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';
  const build = Constants.nativeBuildVersion;
  return (
    <ScreenContainer>
      <View style={styles.hero}>
        <View style={styles.icon}><Ionicons name="storefront" size={36} color={colors.white} /></View>
        <Text style={styles.title}>Sari-sari Store</Text>
        <Text style={styles.version}>Version {version}{build ? ` (${build})` : ''}</Text>
      </View>
      <Card>
        <Text style={styles.heading}>Inventory and Point of Sale</Text>
        <Text style={styles.copy}>Offline-first product, sales, customer utang, receipt, and printing tools for a neighborhood store.</Text>
      </Card>
      <Card>
        <InfoRow icon="server-outline" label="Primary storage" value="SQLite on this device" />
        <InfoRow icon="cloud-outline" label="Backup" value="Optional Supabase sync" />
        <InfoRow icon="shield-checkmark-outline" label="Access" value="Owner PIN protected" />
      </Card>
    </ScreenContainer>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useAppearance();
  const styles = useStyles();
  return <View style={styles.row}><View style={styles.rowIcon}><Ionicons name={icon} size={19} color={colors.primary} /></View><View style={styles.rowText}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View></View>;
}

const useStyles = createThemedStyles((colors) => ({
  hero: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  icon: { width: 72, height: 72, borderRadius: radius.xl, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: typography.title, fontWeight: typography.bold },
  version: { color: colors.textMuted, fontSize: typography.bodySmall },
  heading: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold },
  copy: { color: colors.textMuted, fontSize: typography.body, lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  rowIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 }, label: { color: colors.textMuted, fontSize: typography.caption }, value: { color: colors.text, fontSize: typography.body, fontWeight: typography.medium, marginTop: spacing.xs },
}));
