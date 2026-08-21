import { AppHeader, Card, ScreenContainer, SectionTitle, StatCard, StatusBadge } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAppStore } from '@/store/app';
import { useAuth } from '@/store/auth';
import { greeting, peso } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const actions = [
  { label: 'New Sale', icon: 'cart-outline', route: '/(tabs)/pos', tone: '#EEF3FF' }, { label: 'Scan Barcode', icon: 'scan-outline', route: '/barcode-scanner', tone: '#EAF8EE' },
  { label: 'Add Product', icon: 'cube-outline', route: '/add-product', tone: '#EAF8EE' }, { label: 'Add Customer', icon: 'person-add-outline', route: '/add-customer', tone: '#EEF3FF' },
  { label: 'Collect Utang', icon: 'wallet-outline', route: '/(tabs)/utang', tone: '#FEF0F0' }, { label: 'Reports', icon: 'bar-chart-outline', route: '/(tabs)/reports', tone: '#F3F0FF' },
] as const;
export default function HomeScreen() {
  const { user, isAdmin } = useAuth();
  const { products, customers, transactions, reports } = useAppStore();
  const outstanding = customers.reduce((sum, customer) => sum + customer.utang, 0);
  const lowStock = products.filter((product) => product.stock <= product.lowStockThreshold).length;
  return <ScreenContainer><AppHeader title="Sari-sari Store" subtitle={`${greeting()}, ${user?.name}!`} action={<Pressable onPress={() => router.push('/settings')}><Ionicons name="settings-outline" size={23} color={colors.white} /></Pressable>} />
    <View style={styles.stats}><StatCard label="Today's Sales" value={peso(reports.sales.totalSales)} footnote="Saved offline" /><StatCard label="Today's Profit" value={peso(reports.sales.totalProfit)} tone="green" footnote="Based on saved sales" /><StatCard label="Total Products" value={String(products.length)} /><StatCard label="Low Stock" value={String(lowStock)} tone="red" footnote="Needs attention" /><StatCard label="Total Customers" value={String(customers.length)} /><StatCard label="Total Utang" value={peso(outstanding)} tone="orange" /></View>
    <SectionTitle title="Quick Actions" />
    <View style={styles.actions}>{actions.map((action) => <Pressable key={action.label} onPress={() => router.push(action.route)} style={({ pressed }) => [styles.action, { backgroundColor: action.tone }, pressed && { opacity: 0.75 }]}><View style={styles.actionIcon}><Ionicons name={action.icon} size={22} color={colors.primary} /></View><Text style={styles.actionText}>{action.label}</Text></Pressable>)}</View>
    {isAdmin ? <Pressable onPress={() => router.push('/users')} style={styles.admin}><Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} /><View style={{ flex: 1 }}><Text style={styles.adminTitle}>Admin tools</Text><Text style={styles.adminSub}>Manage users and staff access</Text></View><Ionicons name="chevron-forward" size={18} color={colors.textMuted} /></Pressable> : null}
    <SectionTitle title="Recent Transactions" action="View all" />
    <Card style={{ paddingVertical: spacing.xs }}>{transactions.map((transaction) => <Pressable key={transaction.id} onPress={() => router.push({ pathname: '/transaction-details', params: { id: transaction.id } })} style={styles.transaction}><View style={styles.receipt}><Ionicons name="receipt-outline" size={19} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.transactionId}>{transaction.id}</Text><Text style={styles.transactionMeta}>{transaction.time} · {transaction.cashier}</Text></View><View style={{ alignItems: 'flex-end', gap: spacing.xs }}><Text style={styles.amount}>{peso(transaction.amount)}</Text><StatusBadge label={transaction.status} tone={transaction.status === 'Held' ? 'warning' : 'success'} /></View></Pressable>)}</Card>
  </ScreenContainer>;
}
const styles = StyleSheet.create({ stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, action: { width: '31%', minHeight: 90, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: spacing.sm, gap: spacing.sm }, actionIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, actionText: { color: colors.text, fontSize: typography.caption, fontWeight: typography.semibold, textAlign: 'center' }, admin: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: '#C9D7FF', borderRadius: radius.md, backgroundColor: colors.primarySoft, padding: spacing.md }, adminTitle: { color: colors.primary, fontWeight: typography.bold }, adminSub: { color: colors.textMuted, fontSize: typography.caption, marginTop: 2 }, transaction: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, receipt: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, transactionId: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.semibold }, transactionMeta: { color: colors.textMuted, fontSize: typography.caption, marginTop: 3 }, amount: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.bold } });
