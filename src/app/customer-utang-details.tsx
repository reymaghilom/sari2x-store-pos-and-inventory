import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { PrimaryButton, ScreenContainer, SectionTitle, StatusBadge } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { createThemedStyles, useAppearance } from '@/store/appearance';
import { useAppStore } from '@/store/app';
import { formatStoredDate } from '@/utils/date';
import { peso } from '@/utils/format';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

export default function CustomerUtangDetails() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { customers, credits, payments } = useAppStore();
  const customer = customers.find((item) => item.id === id);
  if (!customer) return <PlaceholderScreen title="Customer not found" description="Choose a customer from the Utang list." />;
  const history = payments.filter((payment) => payment.customerId === customer.id);
  const customerCredits = credits.filter((credit) => credit.customerId === customer.id);
  const totalCredit = customerCredits.reduce((sum, credit) => sum + credit.amount, 0);
  const paid = totalCredit - customer.utang;

  return <ScreenContainer>
    <View style={styles.header}><Text style={styles.name}>{customer.name}</Text><Text style={styles.phone}>{customer.phone}</Text>{!customer.allowUtang ? <Text style={styles.disabled}>Utang Disabled · Existing history is preserved</Text> : null}</View>
    <View style={styles.stats}>{customer.allowUtang ? <><Stat label="Credit Limit" value={peso(customer.creditLimit)} /><Stat label="Outstanding Balance" value={peso(customer.utang)} danger /><Stat label="Remaining Credit" value={peso(customer.remainingCredit)} /></> : <Stat label="Outstanding Balance" value={peso(customer.utang)} danger />}<Stat label="Total Paid" value={peso(Math.max(0, paid))} /></View>
    {customer.allowUtang || customer.utang > 0 ? <View style={styles.actions}>{customer.allowUtang ? <PrimaryButton title="New Utang" onPress={() => router.push({ pathname: '/new-utang', params: { id: customer.id } })} style={{ flex: 1 }} /> : null}{customer.utang > 0 ? <PrimaryButton title="Collect Payment" onPress={() => router.push({ pathname: '/collect-payment', params: { id: customer.id } })} style={{ flex: 1 }} /> : null}</View> : null}
    <SectionTitle title="Credit History" />
    {customerCredits.map((credit) => <View key={credit.id} style={styles.row}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{credit.description}</Text><Text style={styles.rowMeta}>{credit.date} · Due {formatStoredDate(credit.dueDate)}</Text>{credit.notes ? <Text style={styles.rowMeta}>Notes: {credit.notes}</Text> : null}</View><View style={styles.end}><Text style={styles.amount}>{peso(credit.remaining)}</Text><StatusBadge label={credit.status} tone={credit.status === 'Paid' ? 'success' : credit.status === 'Overdue' ? 'danger' : 'warning'} /></View></View>)}
    <SectionTitle title="Payment History" />
    {history.length ? history.map((payment) => <View key={payment.id} style={styles.row}><View><Text style={styles.rowTitle}>{payment.date}</Text><Text style={styles.rowMeta}>{payment.method}{payment.reference ? ` · ${payment.reference}` : ''}</Text></View><Text style={styles.paid}>{peso(payment.amount)}</Text></View>) : <Text style={styles.empty}>No payments recorded in this session.</Text>}
  </ScreenContainer>;
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const { colors } = useAppearance(); const styles = useStyles();
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={[styles.statValue, danger && { color: colors.danger }]}>{value}</Text></View>;
}

const useStyles = createThemedStyles((colors) => ({
  header: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.xl },
  name: { color: colors.white, fontSize: typography.title, fontWeight: typography.bold },
  phone: { color: '#DCE6FF', marginTop: spacing.xs }, disabled: { color: colors.warningSoft, fontSize: typography.bodySmall, fontWeight: typography.semibold, marginTop: spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, stat: { width: '48%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  statLabel: { color: colors.textMuted, fontSize: typography.caption }, statValue: { color: colors.text, fontWeight: typography.bold, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  rowTitle: { color: colors.text, fontWeight: typography.semibold, fontSize: typography.bodySmall }, rowMeta: { color: colors.textMuted, fontSize: typography.caption, marginTop: spacing.xs },
  end: { alignItems: 'flex-end', gap: spacing.xs }, amount: { color: colors.text, fontWeight: typography.bold }, paid: { color: colors.success, fontWeight: typography.bold }, empty: { color: colors.textMuted, textAlign: 'center' },
}));
