import { createThemedStyles, useAppearance } from '@/store/appearance';
import { AppHeader, Card, ScreenContainer, SectionTitle, StatCard, StatusBadge } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { useAppStore } from '@/store/app';
import { useAuth } from '@/store/auth';
import { greeting, peso } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

const actions = [
  { label: 'New Sale', icon: 'cart-outline', route: '/(tabs)/pos', tone: 'primarySoft' },
  { label: 'Scan Barcode', icon: 'scan-outline', route: '/barcode-scanner', tone: 'successSoft' },
  { label: 'Add Product', icon: 'cube-outline', route: '/add-product', tone: 'successSoft' },
  { label: 'Add Customer', icon: 'person-add-outline', route: '/add-customer', tone: 'surfaceMuted' },
  { label: 'Collect Utang', icon: 'wallet-outline', route: '/(tabs)/utang', tone: 'dangerSoft' },
  { label: 'Reports', icon: 'bar-chart-outline', route: '/(tabs)/reports', tone: 'surfaceMuted' },
] as const;

export default function HomeScreen() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const { user } = useAuth();
  const { products, customers, transactions, reports } = useAppStore();
  const outstanding = customers.reduce((sum, customer) => sum + customer.utang, 0);
  const lowStock = products.filter((product) => product.stock <= product.lowStockThreshold).length;

  return (
    <ScreenContainer>
      <AppHeader title="Sari-sari Store" subtitle={`${greeting()}, ${user?.name}!`} action={<Pressable accessibilityLabel="Open Settings" onPress={() => router.push('/settings')}><Ionicons name="settings-outline" size={23} color={colors.primaryText} /></Pressable>} />
      <View style={styles.stats}>
        <StatCard label="Today's Sales" value={peso(reports.sales.todaySales)} icon="trending-up-outline" />
        <StatCard label="Today's Profit" value={peso(reports.sales.todayProfit)} tone="green" icon="cash-outline" />
        <StatCard label="Total Products" value={String(products.length)} tone="neutral" icon="cube-outline" />
        <StatCard label="Low Stock" value={String(lowStock)} tone="orange" footnote="Needs attention" icon="warning-outline" />
        <StatCard label="Total Customers" value={String(customers.length)} tone="neutral" icon="people-outline" />
        <StatCard label="Total Utang" value={peso(outstanding)} tone="red" icon="wallet-outline" />
      </View>
      <SectionTitle title="Quick Actions" />
      <View style={styles.actions}>
        {actions.map((action) => <Pressable key={action.label} onPress={() => router.push(action.route)} style={({ pressed }) => [styles.action, { backgroundColor: colors[action.tone] }, pressed && styles.pressed]}><View style={styles.actionIcon}><Ionicons name={action.icon} size={22} color={colors.primary} /></View><Text style={styles.actionText}>{action.label}</Text></Pressable>)}
      </View>
      <SectionTitle title="Recent Transactions" action="View all" onAction={() => router.push('/transaction-history')} />
      <Card style={styles.transactions}>
        {transactions.slice(0, 5).map((transaction) => <Pressable key={transaction.saleId} onPress={() => router.push({ pathname: '/transaction-details', params: { saleId: transaction.saleId } })} style={({ pressed }) => [styles.transaction, pressed && styles.pressed]}><View style={styles.receipt}><Ionicons name="receipt-outline" size={19} color={colors.primary} /></View><View style={styles.transactionCopy}><Text style={styles.transactionId}>{transaction.id}</Text><Text style={styles.transactionMeta}>{transaction.time} · {transaction.cashier}</Text></View><View style={styles.transactionEnd}><Text style={styles.amount}>{peso(transaction.amount)}</Text><StatusBadge label={transaction.status} tone={transaction.status === 'Completed' ? 'success' : transaction.status === 'Held' || transaction.status === 'Partially Refunded' ? 'warning' : 'danger'} /></View></Pressable>)}
        {!transactions.length ? <Text style={styles.emptyTransactions}>No transactions yet.</Text> : null}
      </Card>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles((colors) => ({
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { width: '31%', minHeight: 90, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.border },
  actionIcon: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: colors.textPrimary, fontSize: typography.caption, fontWeight: typography.semibold, textAlign: 'center' },
  transactions: { paddingVertical: spacing.xs },
  transaction: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  transactionCopy: { flex: 1 },
  transactionEnd: { alignItems: 'flex-end', gap: spacing.xs },
  receipt: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  transactionId: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  transactionMeta: { color: colors.textSecondary, fontSize: typography.caption, marginTop: spacing.xs },
  amount: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.bold },
  emptyTransactions: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl },
  pressed: { opacity: 0.75 },
}));
