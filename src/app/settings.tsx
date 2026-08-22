import { ScreenContainer, StatusBadge } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { getStoreInformation, StoreInformation } from '@/services/appSettings';
import { useAppearance, createThemedStyles } from '@/store/appearance';
import { useAuth } from '@/store/auth';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

export default function Settings() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const { user, lock } = useAuth();
  const { preference } = useAppearance();
  const [store, setStore] = useState<StoreInformation>({ storeName: 'Sari-sari Store', ownerName: 'Owner', address: '', phone: '' });

  useFocusEffect(useCallback(() => {
    let active = true;
    void getStoreInformation().then((value) => { if (active) setStore(value); });
    return () => { active = false; };
  }, []));

  const appearanceLabel = preference === 'system' ? 'Use Device Setting' : preference === 'dark' ? 'Dark' : 'Light';
  return (
    <ScreenContainer>
      <View style={styles.store}>
        <View style={styles.storeIcon}><Ionicons name="storefront" size={28} color={colors.primary} /></View>
        <View style={styles.storeText}>
          <Text style={styles.storeName}>{store.storeName}</Text>
          <Text style={styles.user}>{store.ownerName || user?.name || 'Owner'} · Owner</Text>
        </View>
        <StatusBadge label="Active" />
      </View>

      <SettingsGroup title="Store">
        <SettingRow label="Store Information" icon="storefront-outline" onPress={() => router.push('/store-information' as never)} />
        <SettingRow label="Payment Methods" icon="card-outline" onPress={() => router.push('/payment-methods' as never)} />
      </SettingsGroup>

      <SettingsGroup title="Hardware">
        <SettingRow label="Barcode Scanner" icon="barcode-outline" onPress={() => router.push('/scanner-settings' as never)} />
        <SettingRow label="Printer Setup" icon="print-outline" onPress={() => router.push('/printer-setup')} />
      </SettingsGroup>

      <SettingsGroup title="Data Management">
        <SettingRow label="Cloud Backup" icon="cloud-outline" onPress={() => router.push('/backup-sync')} />
        <SettingRow label="Reset Store Completely" icon="trash-outline" danger onPress={() => router.push('/reset-store' as never)} />
      </SettingsGroup>

      <SettingsGroup title="Preferences">
        <SettingRow label="Appearance" detail={appearanceLabel} icon="contrast-outline" onPress={() => router.push('/appearance' as never)} />
        <SettingRow label="Security" icon="shield-checkmark-outline" onPress={() => router.push('/security')} />
      </SettingsGroup>

      <SettingsGroup title="Application">
        <SettingRow label="About" icon="information-circle-outline" onPress={() => router.push('/about' as never)} />
      </SettingsGroup>

      <Pressable style={styles.logout} onPress={lock}>
        <Ionicons name="lock-closed-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Lock App</Text>
      </Pressable>
    </ScreenContainer>
  );
}

function SettingsGroup({ children, title }: { children: React.ReactNode; title: string }) {  const styles = useStyles();
  return <View style={styles.group}><Text style={styles.section}>{title}</Text><View style={styles.list}>{children}</View></View>;
}

function SettingRow({ detail, label, icon, onPress, danger = false }: { detail?: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; danger?: boolean }) {
  const { colors } = useAppearance();
  const styles = useStyles();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primary} /><Text style={[styles.label, danger && styles.dangerLabel]}>{label}</Text>{detail ? <Text style={styles.detail}>{detail}</Text> : null}<Ionicons name="chevron-forward" size={17} color={danger ? colors.danger : colors.textMuted} /></Pressable>;
}

const useStyles = createThemedStyles((colors) => ({
  store: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg },
  storeIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  storeText: { flex: 1 },
  storeName: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold },
  user: { color: colors.textMuted, fontSize: typography.bodySmall, marginTop: spacing.xs },
  group: { gap: spacing.sm },
  section: { color: colors.textMuted, fontSize: typography.caption, fontWeight: typography.bold, textTransform: 'uppercase' },
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md, overflow: 'hidden' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  pressed: { opacity: 0.65 },
  label: { flex: 1, color: colors.text, fontSize: typography.body },
  dangerLabel: { color: colors.danger, fontWeight: typography.semibold },
  detail: { color: colors.textMuted, fontSize: typography.bodySmall },
  logout: { minHeight: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surface },
  logoutText: { color: colors.danger, fontWeight: typography.semibold },
}));
