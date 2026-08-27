import { createThemedStyles, useAppearance } from '@/store/appearance';
import { PrimaryButton, ScreenContainer, SecondaryButton, StatusBadge } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { getSaleReceipt } from '@/database/repositories/receipts';
import { BluetoothPrinterError, printReceiptToBluetooth } from '@/services/bluetoothPrinter';
import { printReceipt, ReceiptActionError, shareReceiptPdf } from '@/services/receipt';
import { SaleReceipt } from '@/types';
import { peso } from '@/utils/format';
import { formatStoredDate } from '@/utils/date';
import { discountLabel } from '@/utils/discount';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';

export default function ReceiptScreen() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const { saleId } = useLocalSearchParams<{ saleId?: string }>();
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<'print' | 'share' | 'bluetooth' | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!saleId) {
        if (active) { setError('No sale was selected.'); setLoading(false); }
        return;
      }
      try {
        const persistedReceipt = await getSaleReceipt(saleId);
        if (!active) return;
        if (!persistedReceipt) setError('This receipt could not be found in local sales history.');
        else setReceipt(persistedReceipt);
      } catch {
        if (active) setError('The receipt could not be loaded from this device. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [saleId]);

  const runAction = async (nextAction: 'print' | 'share') => {
    if (!receipt || action) return;
    if (!receipt.items.length) {
      Alert.alert('Receipt incomplete', 'The saved sale has no item snapshots, so a complete receipt cannot be printed or shared.');
      return;
    }
    setAction(nextAction);
    try {
      if (nextAction === 'print') await printReceipt(receipt);
      else await shareReceiptPdf(receipt);
    } catch (actionError) {
      const fallback = nextAction === 'print' ? 'The Android print dialog could not be opened.' : 'The receipt PDF could not be shared.';
      Alert.alert(nextAction === 'print' ? 'Unable to print' : 'Unable to share', actionError instanceof ReceiptActionError ? actionError.message : fallback);
    } finally {
      setAction(null);
    }
  };

  const runBluetoothPrint = async () => {
    if (!receipt || action) return;
    setAction('bluetooth');
    try {
      await printReceiptToBluetooth(receipt);
      Alert.alert('Receipt sent', 'The receipt was sent to the Bluetooth printer.');
    } catch (printError) {
      const setup = printError instanceof BluetoothPrinterError && (printError.code === 'NOT_CONFIGURED' || printError.code === 'UNAVAILABLE');
      Alert.alert('Bluetooth printing unavailable', printError instanceof Error ? printError.message : 'The receipt could not be printed.', setup ? [{ text: 'Cancel', style: 'cancel' }, { text: 'Printer Setup', onPress: () => router.push('/printer-setup') }] : undefined);
    } finally { setAction(null); }
  };

  if (loading) return <ScreenContainer scroll={false} style={styles.state}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.stateText}>Loading receipt from this device…</Text></ScreenContainer>;
  if (!receipt || error) return <ScreenContainer scroll={false} style={styles.state}><Ionicons name="receipt-outline" size={64} color={colors.textMuted} /><Text style={styles.stateTitle}>Receipt unavailable</Text><Text style={styles.stateText}>{error}</Text><PrimaryButton title="Go Back" onPress={() => router.back()} style={styles.stateButton} /></ScreenContainer>;

  const createdAt = new Date(receipt.createdAt);
  const validDate = !Number.isNaN(createdAt.getTime());
  const date = validDate ? createdAt.toLocaleDateString('en-PH', { dateStyle: 'medium' }) : receipt.createdAt;
  const time = validDate ? createdAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '';

  return <ScreenContainer>
    <View style={styles.paper}>
      <Text style={styles.store}>{receipt.storeName}</Text>
      {receipt.storeAddress ? <Text style={styles.centerMuted}>{receipt.storeAddress}</Text> : null}
      {receipt.storePhone ? <Text style={styles.centerMuted}>{receipt.storePhone}</Text> : null}
      <StatusBadge label={receipt.status.toUpperCase()} tone={receipt.status === 'Completed' ? 'success' : receipt.status === 'Held' ? 'warning' : 'danger'} />
      {receipt.status !== 'Completed' && receipt.status !== 'Held' ? <View style={styles.reversal}><Text style={styles.reversalTitle}>{receipt.status.toUpperCase()}</Text>{receipt.refundAmount !== undefined ? <Text style={styles.reversalText}>Refund amount: {peso(receipt.refundAmount)} · {receipt.refundMethod}</Text> : null}<Text style={styles.reversalText}>Reason: {receipt.reversalReason}</Text><Text style={styles.reversalText}>By {receipt.reversedBy} · {receipt.reversedAt ? new Date(receipt.reversedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : ''}</Text></View> : null}
      <Divider />
      <ReceiptLine label="Transaction No." value={receipt.transactionNumber} />
      <ReceiptLine label="Date" value={date} />
      {time ? <ReceiptLine label="Time" value={time} /> : null}
      <ReceiptLine label="Cashier" value={receipt.cashier} />
      {receipt.customer ? <ReceiptLine label="Customer" value={receipt.customer} /> : null}
      <Divider />
      {receipt.items.length ? receipt.items.map((item) => <View key={item.id} style={styles.item}>
        <Text style={styles.itemName}>{item.productName}</Text>
        <ReceiptLine label={`${item.quantity} × ${peso(item.unitPrice)}`} value={peso(item.lineTotal)} />
      </View>) : <View style={styles.warning}><Ionicons name="alert-circle-outline" size={20} color={colors.warning} /><Text style={styles.warningText}>No saved item snapshots were found for this sale.</Text></View>}
      <Divider />
      <ReceiptLine label="Subtotal" value={peso(receipt.subtotal)} />
      {receipt.discount > 0 ? <ReceiptLine label={discountLabel(receipt.discountType, receipt.discountValue, peso)} value={`−${peso(receipt.discount)}`} /> : null}
      <ReceiptLine label="Total" value={peso(receipt.total)} strong />
      <ReceiptLine label="Payment" value={receipt.paymentMethod} />
      {receipt.paymentMethod === 'Cash' ? <><ReceiptLine label="Cash Received" value={peso(receipt.cashReceived ?? receipt.total)} /><ReceiptLine label="Change" value={peso(receipt.change ?? 0)} /></> : null}
      {(receipt.paymentMethod === 'GCash' || receipt.paymentMethod === 'Maya') && receipt.reference ? <ReceiptLine label="Reference" value={receipt.reference} /> : null}
      {receipt.paymentMethod === 'Utang' ? <><ReceiptLine label="Amount Charged" value={peso(receipt.total)} /><ReceiptLine label="Due Date" value={formatStoredDate(receipt.dueDate) || 'Not set'} />{receipt.notes ? <ReceiptLine label="Notes" value={receipt.notes} /> : null}</> : null}
      <Divider />
      <Text style={styles.thanks}>Thank you!</Text>
      <Text style={styles.centerMuted}>Please come again.</Text>
    </View>
    <View style={styles.actions}>
      <PrimaryButton title={action === 'print' ? 'Opening Print…' : 'Print Receipt'} icon="print-outline" loading={action === 'print'} onPress={() => void runAction('print')} style={styles.actionButton} />
      <SecondaryButton title={action === 'share' ? 'Preparing PDF…' : 'Share Receipt'} icon="share-outline" onPress={() => void runAction('share')} style={styles.actionButton} />
    </View>
    <SecondaryButton title={action === 'bluetooth' ? 'Sending to Printer…' : 'Print to Bluetooth Printer'} icon="bluetooth-outline" onPress={() => void runBluetoothPrint()} />
  </ScreenContainer>;
}

function ReceiptLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {  const styles = useStyles();
  return <View style={styles.line}><Text style={[styles.label, strong && styles.total]}>{label}</Text><Text selectable style={[styles.value, strong && styles.total]}>{value}</Text></View>;
}

function Divider() {  const styles = useStyles(); return <View style={styles.divider} />; }

const useStyles = createThemedStyles((colors) => ({
  paper: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  store: { color: colors.text, fontSize: typography.title, fontWeight: typography.bold, textAlign: 'center' },
  centerMuted: { color: colors.textMuted, fontSize: typography.bodySmall, textAlign: 'center' },
  divider: { alignSelf: 'stretch', borderBottomWidth: 1, borderStyle: 'dashed', borderColor: colors.textMuted, marginVertical: spacing.xs },
  item: { alignSelf: 'stretch', gap: spacing.xs },
  itemName: { color: colors.text, fontWeight: typography.semibold },
  line: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  label: { flex: 1, color: colors.textMuted, fontSize: typography.bodySmall },
  value: { flex: 1, color: colors.text, fontSize: typography.bodySmall, textAlign: 'right', fontWeight: typography.medium },
  total: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold },
  thanks: { color: colors.text, textAlign: 'center', fontWeight: typography.semibold, marginTop: spacing.xs },
  warning: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.warningSoft },
  warningText: { flex: 1, color: colors.warning, fontSize: typography.bodySmall },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1 },
  state: { alignItems: 'center', justifyContent: 'center' },
  stateTitle: { color: colors.text, fontSize: typography.title, fontWeight: typography.bold, textAlign: 'center' },
  stateText: { color: colors.textMuted, textAlign: 'center' },
  stateButton: { alignSelf: 'stretch', marginTop: spacing.md },
  reversal: { alignSelf: 'stretch', alignItems: 'center', gap: spacing.xs, padding: spacing.md, backgroundColor: colors.dangerSoft, borderRadius: radius.md },
  reversalTitle: { color: colors.danger, fontSize: typography.title, fontWeight: typography.bold },
  reversalText: { color: colors.danger, fontSize: typography.bodySmall, textAlign: 'center' },
}));
