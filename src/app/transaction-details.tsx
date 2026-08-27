import { createThemedStyles } from '@/store/appearance';
import { FormField } from '@/components/FormField';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { PrimaryButton, ScreenContainer, SecondaryButton, StatusBadge } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { useKeyboardAwareForm } from '@/hooks/useKeyboardAwareForm';
import { useRole } from '@/hooks/useRole';
import { getSaleReceipt } from '@/database/repositories/receipts';
import { useAppStore } from '@/store/app';
import { useAuth } from '@/store/auth';
import { peso } from '@/utils/format';
import { formatStoredDate } from '@/utils/date';
import { discountLabel } from '@/utils/discount';
import { SaleReceipt } from '@/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

type Action = 'void' | 'refund';
type RefundMethod = 'Cash' | 'GCash' | 'Maya';

export default function TransactionDetails() {  const styles = useStyles();
  const { saleId } = useLocalSearchParams<{ saleId?: string }>();
  const { transactions, voidTransaction, refundTransaction } = useAppStore();
  const { user } = useAuth();
  const { canReverseTransactions } = useRole();
  const keyboardForm = useKeyboardAwareForm<'reason'>();
  const transaction = transactions.find((item) => item.saleId === saleId);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<RefundMethod>('Cash');
  const [working, setWorking] = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  useEffect(() => { if (!transaction) return; let active = true; void getSaleReceipt(transaction.saleId).then((nextReceipt) => { if (active) setReceipt(nextReceipt); }); return () => { active = false; }; }, [transaction]);
  if (!transaction) return <PlaceholderScreen title="Transaction not found" description="This transaction is not available in local history." icon="receipt-outline" />;

  const submit = () => {
    if (!user || !action || !reason.trim()) { Alert.alert('Reason required', 'Enter a reason before continuing.'); return; }
    const isVoid = action === 'void';
    Alert.alert(isVoid ? 'Void this transaction?' : 'Refund this transaction?', isVoid
      ? 'This will restore the sold items to inventory and mark the sale as voided. This action will remain in the audit history.'
      : transaction.paymentMethod === 'Utang' ? `This will restore all sold items and reverse ${peso(transaction.amount)} from the customer's unpaid Utang balance.` : `This will restore all sold items and record a ${method} refund of ${peso(transaction.amount)}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: isVoid ? 'Void Sale' : 'Issue Refund', style: 'destructive', onPress: () => void (async () => {
        setWorking(true);
        try {
          if (isVoid) await voidTransaction(transaction.saleId, user.id, reason);
          else await refundTransaction(transaction.saleId, user.id, reason, method);
          setAction(null); setReason('');
          Alert.alert(isVoid ? 'Sale voided' : 'Refund recorded', 'Inventory, reports, audit history, and the offline sync queue were updated.');
        } catch (error) { Alert.alert('Transaction not reversed', error instanceof Error ? error.message : 'Please try again.'); }
        finally { setWorking(false); }
      })() },
    ]);
  };

  const tone = transaction.status === 'Completed' ? 'success' : transaction.status === 'Voided' || transaction.status === 'Refunded' ? 'danger' : 'warning';
  return <ScreenContainer {...keyboardForm.screenProps}><View style={styles.receipt}><Text style={styles.store}>Sari-sari Store</Text><Text style={styles.id}>{transaction.id}</Text><StatusBadge label={transaction.status} tone={tone} /><View style={styles.divider} /><Detail label="Date / Time" value={transaction.time} /><Detail label="Original Cashier" value={transaction.cashier} /><Detail label="Payment Method" value={transaction.paymentMethod} />{transaction.customer ? <Detail label="Customer" value={transaction.customer} /> : null}{transaction.dueDate ? <Detail label="Due Date" value={formatStoredDate(transaction.dueDate)} /> : null}{transaction.notes ? <Detail label="Notes" value={transaction.notes} /> : null}<View style={styles.divider} />{receipt?.items.map((item) => <Detail key={item.id} label={`${item.quantity} × ${item.productName}`} value={peso(item.lineTotal)} />)}<View style={styles.divider} />{receipt ? <><Detail label="Subtotal" value={peso(receipt.subtotal)} />{receipt.discount > 0 ? <Detail label={discountLabel(receipt.discountType, receipt.discountValue, peso)} value={`−${peso(receipt.discount)}`} /> : null}</> : null}<Detail label="Original Total" value={peso(transaction.amount)} strong />
    {transaction.reversalReason ? <><View style={styles.divider} /><Detail label="Reason" value={transaction.reversalReason} /><Detail label="Reversed By" value={transaction.reversedBy ?? 'Unknown owner'} /><Detail label="Reversed At" value={transaction.reversedAt ?? 'Unknown time'} />{transaction.refundAmount !== undefined ? <Detail label="Refund" value={`${peso(transaction.refundAmount)} · ${transaction.refundMethod}`} /> : null}</> : null}
  </View>
  <PrimaryButton title="View Receipt" icon="receipt-outline" style={styles.button} onPress={() => router.push({ pathname: '/receipt', params: { saleId: transaction.saleId } })} />
  {transaction.status === 'Completed' && canReverseTransactions ? <View style={styles.actions}><SecondaryButton title="Void Sale" icon="close-circle-outline" onPress={() => { setAction('void'); setReason(''); }} style={{ flex: 1 }} /><SecondaryButton title="Refund" icon="return-up-back-outline" onPress={() => { setAction('refund'); setReason(''); }} style={{ flex: 1 }} /></View> : null}
  {transaction.status === 'Completed' && !canReverseTransactions ? <Text style={styles.restricted}>Owner access is required to void or refund this transaction.</Text> : null}
  {action ? <View style={styles.form}><Text style={styles.formTitle}>{action === 'void' ? 'Void Sale' : 'Full Refund'}</Text><Text style={styles.hint}>Examples: Wrong item, duplicate transaction, incorrect quantity, customer cancelled, cashier mistake, or other.</Text><FormField {...keyboardForm.fieldProps('reason')} label="Reason *" value={reason} onChangeText={setReason} placeholder="Enter the audit reason" multiline />
    {action === 'refund' ? transaction.paymentMethod === 'Utang' ? <Text style={styles.hint}>Refund method: Credit reversal. No cash will be issued. Sales with an allocated Utang payment are blocked.</Text> : <><Text style={styles.methodLabel}>Refund method</Text><View style={styles.methods}>{(['Cash', 'GCash', 'Maya'] as RefundMethod[]).map((item) => <Pressable key={item} onPress={() => setMethod(item)} style={[styles.method, method === item && styles.methodActive]}><Text style={[styles.methodText, method === item && styles.methodTextActive]}>{item}</Text></Pressable>)}</View></> : null}
    <View style={styles.actions}><SecondaryButton title="Cancel" onPress={() => setAction(null)} style={{ flex: 1 }} /><PrimaryButton title="Continue" disabled={!reason.trim()} loading={working} onPress={submit} style={{ flex: 1 }} /></View>
  </View> : null}</ScreenContainer>;
}
function Detail({ label, value, strong }: { label: string; value: string; strong?: boolean }) {  const styles = useStyles(); return <View style={styles.line}><Text style={styles.label}>{label}</Text><Text style={[styles.value, strong && styles.strong]}>{value}</Text></View>; }
const useStyles = createThemedStyles((colors) => ({ receipt: { alignItems: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.lg }, store: { color: colors.primary, fontSize: typography.title, fontWeight: typography.bold }, id: { color: colors.textMuted }, divider: { height: 1, backgroundColor: colors.border, alignSelf: 'stretch' }, line: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }, label: { color: colors.textMuted }, value: { flex: 1, color: colors.text, fontWeight: typography.medium, textAlign: 'right' }, strong: { fontSize: typography.subtitle, fontWeight: typography.bold }, button: { alignSelf: 'stretch' }, actions: { flexDirection: 'row', gap: spacing.sm }, restricted: { color: colors.warning, textAlign: 'center' }, form: { gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }, formTitle: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold }, hint: { color: colors.textMuted, fontSize: typography.bodySmall }, methodLabel: { color: colors.text, fontWeight: typography.semibold }, methods: { flexDirection: 'row', gap: spacing.sm }, method: { flex: 1, padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, alignItems: 'center' }, methodActive: { backgroundColor: colors.primary, borderColor: colors.primary }, methodText: { color: colors.text }, methodTextActive: { color: colors.white, fontWeight: typography.semibold } }));
