import { createThemedStyles, useAppearance } from '@/store/appearance';
import { PrimaryButton, ScreenContainer, SecondaryButton } from '@/components/ui';
import { spacing, typography } from '@/constants/theme';
import { getSaleReceipt } from '@/database/repositories/receipts';
import { BluetoothPrinterError, printReceiptToBluetooth } from '@/services/bluetoothPrinter';
import { getPrinterSettings } from '@/services/printerSettings';
import { printReceipt, ReceiptActionError, shareReceiptPdf } from '@/services/receipt';
import { useAppStore } from '@/store/app';
import { peso } from '@/utils/format';
import { discountLabel } from '@/utils/discount';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

export default function PaymentSuccess() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const { saleId: routeSaleId, customerId } = useLocalSearchParams<{ saleId?: string; customerId?: string }>();
  const { lastSale } = useAppStore();
  const [action, setAction] = useState<'print' | 'share' | 'bluetooth' | null>(null);
  const autoPrintAttempted = useRef<string | null>(null);
  const saleId = routeSaleId ?? lastSale?.saleId;

  const runReceiptAction = async (nextAction: 'print' | 'share') => {
    if (!saleId || action) return;
    setAction(nextAction);
    try {
      const receipt = await getSaleReceipt(saleId);
      if (!receipt) {
        Alert.alert('Receipt unavailable', 'The saved sale could not be found in local history.');
        return;
      }
      if (!receipt.items.length) {
        Alert.alert('Receipt incomplete', 'The saved sale has no item snapshots, so a complete receipt cannot be printed or shared.');
        return;
      }
      if (nextAction === 'print') await printReceipt(receipt);
      else await shareReceiptPdf(receipt);
    } catch (actionError) {
      const fallback = nextAction === 'print' ? 'The Android print dialog could not be opened.' : 'The receipt PDF could not be shared.';
      Alert.alert(nextAction === 'print' ? 'Unable to print' : 'Unable to share', actionError instanceof ReceiptActionError ? actionError.message : fallback);
    } finally {
      setAction(null);
    }
  };

  const runBluetoothPrint = async (automatic = false) => {
    if (!saleId || (!automatic && action)) return;
    if (!automatic) setAction('bluetooth');
    try {
      const receipt = await getSaleReceipt(saleId);
      if (!receipt) throw new Error('The saved receipt could not be found on this device.');
      await printReceiptToBluetooth(receipt);
      if (!automatic) Alert.alert('Receipt sent', 'The receipt was sent to the Bluetooth printer.');
    } catch (printError) {
      const setup = printError instanceof BluetoothPrinterError && (printError.code === 'NOT_CONFIGURED' || printError.code === 'UNAVAILABLE');
      Alert.alert(automatic ? 'Sale completed — auto-print failed' : 'Bluetooth printing unavailable', printError instanceof Error ? printError.message : 'The receipt could not be printed. The completed sale is unchanged.', setup ? [{ text: 'OK', style: 'cancel' }, { text: 'Printer Setup', onPress: () => router.push('/printer-setup') }] : undefined);
    } finally { if (!automatic) setAction(null); }
  };

  useEffect(() => {
    if (!saleId || autoPrintAttempted.current === saleId) return;
    autoPrintAttempted.current = saleId;
    void getPrinterSettings().then((settings) => { if (settings.autoPrint) void runBluetoothPrint(true); });
  // One attempt per persisted sale ID prevents re-render duplicate prints.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  if (!lastSale) return <ScreenContainer style={styles.page}><Text style={styles.title}>No completed sale</Text><PrimaryButton title="Start New Sale" onPress={() => router.replace('/(tabs)/pos')} /></ScreenContainer>;

  return <ScreenContainer style={styles.page}>
    <View style={styles.check}><Ionicons name="checkmark" size={54} color={colors.success} /></View>
    <Text style={styles.title}>Sale Completed!</Text>
    <Text style={styles.id}>{lastSale.id}</Text>
    <View style={styles.details}>
      <Detail label="Date / Time" value={lastSale.date} />
      <Detail label="Cashier" value={lastSale.cashier} />
      {lastSale.customer ? <Detail label="Customer" value={lastSale.customer} /> : null}
      <Detail label="Payment Method" value={lastSale.paymentMethod} />
      <Detail label="Subtotal" value={peso(lastSale.subtotal)} />
      {lastSale.discount > 0 ? <Detail label={discountLabel(lastSale.discountType, lastSale.discountValue, peso)} value={`−${peso(lastSale.discount)}`} /> : null}
      <Detail label="Total Amount" value={peso(lastSale.total)} />
      {lastSale.cashReceived !== undefined ? <Detail label="Cash Received" value={peso(lastSale.cashReceived)} /> : null}
      {lastSale.change !== undefined ? <Detail label="Change" value={peso(lastSale.change)} success /> : null}
    </View>
    <PrimaryButton title="View Receipt" icon="receipt-outline" onPress={() => saleId && router.push({ pathname: '/receipt', params: { saleId } })} />
    <SecondaryButton title={action === 'share' ? 'Preparing PDF…' : 'Share Receipt'} icon="share-outline" onPress={() => void runReceiptAction('share')} />
    <SecondaryButton title={action === 'print' ? 'Opening Print…' : 'Print Receipt'} icon="print-outline" onPress={() => void runReceiptAction('print')} />
    <SecondaryButton title={action === 'bluetooth' ? 'Sending to Printer…' : 'Print to Bluetooth Printer'} icon="bluetooth-outline" onPress={() => void runBluetoothPrint()} />
    {lastSale.paymentMethod === 'Utang' && customerId ? <SecondaryButton title="View Customer Utang" icon="person-outline" onPress={() => router.replace({ pathname: '/customer-utang-details', params: { id: customerId } })} /> : null}
    <SecondaryButton title="New Sale" onPress={() => router.replace('/(tabs)/pos')} />
  </ScreenContainer>;
}

function Detail({ label, value, success }: { label: string; value: string; success?: boolean }) {
  const { colors } = useAppearance();
  const styles = useStyles();
  return <View style={styles.line}><Text style={styles.label}>{label}</Text><Text style={[styles.value, success && { color: colors.success }]}>{value}</Text></View>;
}

const useStyles = createThemedStyles((colors) => ({
  page: { justifyContent: 'center' },
  check: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.success, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center', fontSize: typography.title, color: colors.success, fontWeight: typography.bold },
  id: { textAlign: 'center', color: colors.textMuted },
  details: { gap: spacing.md, backgroundColor: colors.surface, padding: spacing.xl, borderRadius: 16 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  label: { color: colors.textMuted, flex: 1 },
  value: { color: colors.text, fontWeight: typography.bold, flex: 1, textAlign: 'right' },
}));
