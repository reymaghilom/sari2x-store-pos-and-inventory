import { createThemedStyles, useAppearance } from '@/store/appearance';
import { Card, ScreenContainer, AppHeader, StatusBadge } from '@/components/ui';
import { FilterChips } from '@/components/FilterChips';
import { radius, spacing, typography } from '@/constants/theme';
import { useAppStore } from '@/store/app';
import { peso } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

export default function UtangScreen() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const { customers, credits } = useAppStore();
  const [filter, setFilter] = useState('All');
  const rows = useMemo(() => customers.map((customer) => {
    const records = credits.filter((credit) => credit.customerId === customer.id);
    const latest = records[0];
    const state = customer.utang === 0 ? 'Paid' : records.some((credit) => credit.status === 'Overdue' && credit.remaining > 0) ? 'Overdue' : 'Due';
    return { customer, date: `${latest?.date ?? 'No recent credit'}${customer.allowUtang ? '' : ' · Utang disabled'}`, state, hasHistory: records.length > 0 };
  }).filter((row) => (row.customer.allowUtang || row.hasHistory || row.customer.utang > 0) && (filter === 'All' || row.state === filter)), [customers, credits, filter]);
  const outstanding = customers.reduce((sum, customer) => sum + customer.utang, 0);
  const count = customers.filter((customer) => customer.utang > 0).length;

  return (
    <ScreenContainer>
      <AppHeader title="Utang / Credit" subtitle="Track customer balances" action={<Pressable onPress={() => router.push('/new-utang')}><Ionicons name="add" size={26} color={colors.primaryText} /></Pressable>} />
      <View style={styles.summary}><Text style={styles.summaryLabel}>Total Outstanding</Text><Text style={styles.summaryValue}>{peso(outstanding)}</Text><Text style={styles.summarySub}>{count} customers with open balances</Text></View>
      <FilterChips items={['All', 'Due', 'Overdue', 'Paid']} active={filter} onChange={setFilter} />
      <Card style={styles.card}>
        {rows.map(({ customer, date, state }) => <Pressable key={customer.id} onPress={() => router.push({ pathname: '/customer-utang-details', params: { id: customer.id } })} style={styles.row}><View style={styles.avatar}><Ionicons name="person-outline" size={20} color={colors.primary} /></View><View style={styles.flex}><Text style={styles.name}>{customer.name}</Text><Text style={styles.date}>{date}</Text></View><View style={styles.end}><Text style={styles.amount}>{peso(customer.utang)}</Text><StatusBadge label={state} tone={state === 'Paid' ? 'success' : state === 'Overdue' ? 'danger' : 'warning'} /></View></Pressable>)}
        {!rows.length ? <Text style={styles.empty}>No records match this filter.</Text> : null}
      </Card>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles((colors) => ({
  summary: { borderRadius: radius.lg, padding: spacing.xl, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder },
  summaryLabel: { color: colors.textMuted, fontSize: typography.bodySmall }, summaryValue: { color: colors.primary, fontSize: typography.display, fontWeight: typography.bold, marginVertical: spacing.xs }, summarySub: { color: colors.textMuted, fontSize: typography.caption },
  card: { paddingVertical: spacing.xs }, row: { minHeight: 72, flexDirection: 'row', gap: spacing.md, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, flex: { flex: 1 }, name: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.semibold }, date: { color: colors.textMuted, fontSize: typography.caption, marginTop: 3 }, end: { alignItems: 'flex-end', gap: spacing.xs }, amount: { fontSize: typography.bodySmall, fontWeight: typography.bold, color: colors.text }, empty: { color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
}));
