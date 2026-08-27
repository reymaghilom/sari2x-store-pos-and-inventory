import { createThemedStyles, useAppearance } from '@/store/appearance';
import { ScreenContainer, StatusBadge } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { useAppStore } from '@/store/app';
import { SaleStatus } from '@/types';
import { peso } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

function statusTone(status: SaleStatus) {
  if (status === 'Completed') return 'success' as const;
  if (status === 'Held' || status === 'Partially Refunded') return 'warning' as const;
  return 'danger' as const;
}

export default function TransactionHistoryScreen() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const { transactions } = useAppStore();

  return (
    <ScreenContainer>
      <View style={styles.summary}>
        <Ionicons name="receipt-outline" size={22} color={colors.primary} />
        <View>
          <Text style={styles.summaryTitle}>All Transactions</Text>
          <Text style={styles.summaryText}>{transactions.length} saved sale{transactions.length === 1 ? '' : 's'}, newest first</Text>
        </View>
      </View>
      <View style={styles.list}>
        {transactions.map((transaction) => (
          <Pressable
            key={transaction.saleId}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/transaction-details', params: { saleId: transaction.saleId } })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.icon}><Ionicons name="receipt-outline" size={20} color={colors.primary} /></View>
            <View style={styles.copy}>
              <Text style={styles.id}>{transaction.id}</Text>
              <Text style={styles.meta}>{transaction.time}</Text>
              <Text style={styles.meta}>{transaction.paymentMethod}{transaction.customer ? ` · ${transaction.customer}` : ''}</Text>
            </View>
            <View style={styles.end}>
              <Text style={styles.amount}>{peso(transaction.amount)}</Text>
              <StatusBadge label={transaction.status} tone={statusTone(transaction.status)} />
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}
        {!transactions.length ? <Text style={styles.empty}>No transactions have been recorded yet.</Text> : null}
      </View>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles((colors) => ({
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: radius.lg },
  summaryTitle: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold },
  summaryText: { color: colors.textMuted, fontSize: typography.bodySmall, marginTop: spacing.xs },
  list: { gap: spacing.sm },
  row: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  pressed: { opacity: 0.76 },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primarySoft },
  copy: { flex: 1 },
  id: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.bold },
  meta: { color: colors.textMuted, fontSize: typography.caption, marginTop: spacing.xs },
  end: { alignItems: 'flex-end', gap: spacing.sm },
  amount: { color: colors.text, fontSize: typography.body, fontWeight: typography.bold },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xxxl },
}));
