import { FilterChips } from '@/components/FilterChips';
import { PrimaryButton, ScreenContainer, SearchBar, StatusBadge } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { createThemedStyles, useAppearance } from '@/store/appearance';
import { useAppStore } from '@/store/app';
import { peso } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

const filters = ['All', 'Suki', 'With Utang', 'Overdue', 'Utang Allowed'];

export default function Customers() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const { select } = useLocalSearchParams<{ select?: string }>();
  const { customers, selectCustomer, beginUtangSale } = useAppStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const choosingForUtang = select === 'new-utang' || select === 'utang-sale' || select === 'cart-utang';
  const visible = useMemo(() => customers.filter((customer) => {
    const matchesSearch = customer.name.toLowerCase().includes(query.trim().toLowerCase()) || customer.phone.includes(query.trim());
    const matchesFilter = filter === 'All'
      || (filter === 'Suki' && customer.customerType === 'suki')
      || (filter === 'With Utang' && customer.utang > 0)
      || (filter === 'Overdue' && customer.overdue)
      || (filter === 'Utang Allowed' && customer.allowUtang);
    return matchesSearch && matchesFilter && (!choosingForUtang || customer.allowUtang);
  }), [choosingForUtang, customers, filter, query]);
  const open = (id: string) => {
    if (select === 'cart' || select === 'cart-utang') { selectCustomer(id); router.back(); }
    else if (select === 'new-utang' || select === 'utang-sale') { beginUtangSale(id); router.replace('/(tabs)/pos'); }
    else if (select === 'payment') router.replace({ pathname: '/collect-payment', params: { id } });
    else router.push({ pathname: '/customer-details', params: { id } });
  };

  return <ScreenContainer>
    <SearchBar placeholder="Search name or phone" value={query} onChangeText={setQuery} />
    <FilterChips items={filters} active={filter} onChange={setFilter} />
    <PrimaryButton title="Add Customer" icon="person-add-outline" onPress={() => router.push('/add-customer')} />
    {select ? <Text style={styles.hint}>{choosingForUtang ? 'Only customers with Allow Utang enabled can be selected.' : 'Select a registered customer to continue.'}</Text> : null}
    <View style={styles.list}>{visible.map((customer) => <Pressable key={customer.id} onPress={() => open(customer.id)} style={styles.row}>
      <View style={styles.avatar}><Ionicons name="person-outline" size={20} color={colors.primary} /></View>
      <View style={styles.identity}><View style={styles.nameRow}><Text style={styles.name}>{customer.name}</Text>{customer.customerType === 'suki' ? <StatusBadge label="Suki" tone="info" /> : null}</View><Text style={styles.phone}>{customer.phone}</Text></View>
      <View style={styles.end}><Text style={styles.balance}>Outstanding: {peso(customer.utang)}</Text><StatusBadge label={customer.overdue ? 'Overdue' : customer.utang ? 'With Utang' : 'Clear'} tone={customer.overdue ? 'danger' : customer.utang ? 'warning' : 'success'} /></View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>)}{!visible.length ? <Text style={styles.hint}>No customers found.</Text> : null}</View>
  </ScreenContainer>;
}

const useStyles = createThemedStyles((colors) => ({
  list: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, gap: 3 }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { flexShrink: 1, color: colors.text, fontWeight: typography.semibold },
  phone: { color: colors.textMuted, fontSize: typography.caption },
  end: { alignItems: 'flex-end', gap: spacing.xs }, balance: { color: colors.text, fontSize: typography.caption, fontWeight: typography.bold },
  hint: { color: colors.textMuted, textAlign: 'center', fontSize: typography.bodySmall, padding: spacing.md },
}));
