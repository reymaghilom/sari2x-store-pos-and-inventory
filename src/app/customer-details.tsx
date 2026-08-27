import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { PrimaryButton, ScreenContainer, SecondaryButton, StatusBadge } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { createThemedStyles, useAppearance } from '@/store/appearance';
import { useAppStore } from '@/store/app';
import { peso } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function CustomerDetails() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { customers, credits } = useAppStore();
  const customer = customers.find((item) => item.id === id);
  if (!customer) return <PlaceholderScreen title="Customer not found" description="Return to Customers and select an available profile." />;
  const defaultDiscount = customer.discountType === 'percentage'
    ? `${customer.discountValue}%`
    : customer.discountType === 'fixed' ? peso(customer.discountValue) : 'None';
  const hasCreditHistory = credits.some((credit) => credit.customerId === customer.id);
  return <ScreenContainer>
    <View style={styles.profile}><View style={styles.avatar}><Ionicons name="person" size={34} color={colors.primary} /></View><View style={styles.nameRow}><Text style={styles.name}>{customer.name}</Text>{customer.customerType === 'suki' ? <StatusBadge label="Suki" tone="info" /> : <StatusBadge label="Regular" tone="success" />}</View><Text style={styles.phone}>{customer.phone}</Text><Text style={styles.address}>{customer.address || 'No address provided'}</Text><Text style={styles.discount}>Customer Type: {customer.customerType === 'suki' ? 'Suki' : 'Regular'}</Text>{customer.customerType === 'suki' ? <Text style={styles.discount}>Default Discount: {defaultDiscount}</Text> : null}<Text style={styles.discount}>Utang: {customer.allowUtang ? 'Allowed' : 'Not Allowed'}</Text></View>
    {customer.allowUtang ? <View style={styles.stats}><Stat label="Credit Limit" value={peso(customer.creditLimit)} /><Stat label="Outstanding Balance" value={peso(customer.utang)} danger /><Stat label="Remaining Credit" value={peso(customer.remainingCredit)} /></View> : customer.utang > 0 ? <><View style={styles.disabledNotice}><Text style={styles.disabledTitle}>Utang Disabled</Text><Text style={styles.disabledText}>Existing Balance: {peso(customer.utang)}</Text><Text style={styles.disabledText}>Payments and history remain available, but new Utang is blocked.</Text></View><View style={styles.stats}><Stat label="Outstanding Balance" value={peso(customer.utang)} danger /></View></> : null}
    <SecondaryButton title="Edit Customer" icon="create-outline" onPress={() => router.push({ pathname: '/edit-customer', params: { id: customer.id } } as never)} />
    {customer.allowUtang || customer.utang > 0 ? <View style={styles.buttons}>{customer.allowUtang ? <PrimaryButton title="New Utang" icon="add-outline" onPress={() => router.push({ pathname: '/new-utang', params: { id: customer.id } })} style={{ flex: 1 }} /> : null}{customer.utang > 0 ? <PrimaryButton title="Collect Payment" icon="wallet-outline" onPress={() => router.push({ pathname: '/collect-payment', params: { id: customer.id } })} style={{ flex: 1 }} /> : null}</View> : null}
    {customer.allowUtang || hasCreditHistory ? <SecondaryButton title="View Utang Details" onPress={() => router.push({ pathname: '/customer-utang-details', params: { id: customer.id } })} /> : null}
  </ScreenContainer>;
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const { colors } = useAppearance(); const styles = useStyles();
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={[styles.statValue, danger && { color: colors.danger }]}>{value}</Text></View>;
}

const useStyles = createThemedStyles((colors) => ({
  profile: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  name: { color: colors.text, fontSize: typography.title, fontWeight: typography.bold },
  phone: { color: colors.primary, marginTop: spacing.xs }, address: { color: colors.textMuted, fontSize: typography.bodySmall, marginTop: spacing.xs },
  discount: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.semibold, marginTop: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm }, stat: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  statLabel: { color: colors.textMuted, fontSize: typography.caption }, statValue: { color: colors.text, fontWeight: typography.bold, fontSize: typography.bodySmall, marginTop: spacing.xs },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  disabledNotice: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning },
  disabledTitle: { color: colors.warning, fontWeight: typography.bold }, disabledText: { color: colors.text, fontSize: typography.bodySmall },
}));
