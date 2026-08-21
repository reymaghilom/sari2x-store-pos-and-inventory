import { PrimaryButton, ScreenContainer, SecondaryButton } from '@/components/ui';
import { colors, spacing, typography } from '@/constants/theme';
import { getSaleReceipt } from '@/database/repositories/receipts';
import { printReceipt, ReceiptActionError, shareReceiptPdf } from '@/services/receipt';
import { useAppStore } from '@/store/app';
import { peso } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

export default function PaymentSuccess() {
  const { saleId: routeSaleId } = useLocalSearchParams<{ saleId?: string }>();
  const { lastSale } = useAppStore();
  const [action, setAction] = useState<'print' | 'share' | null>(null);
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

  if (!lastSale) return <ScreenContainer style={styles.page}><Text style={styles.title}>No completed sale</Text><PrimaryButton title="Start New Sale" onPress={() => router.replace('/(tabs)/pos')} /></ScreenContainer>;

  return <ScreenContainer style={styles.page}>
    <View style={styles.check}><Ionicons name="checkmark" size={54} color={colors.success} /></View>
    <Text style={styles.title}>Sale Completed!</Text>
    <Text style={styles.id}>{lastSale.id}</Text>
    <View style={styles.details}>
      <Detail label="Date / Time" value={lastSale.date} />
      <Detail label="Cashier" value={lastSale.cashier} />
      <Detail label="Customer" value={lastSale.customer} />
      <Detail label="Payment Method" value={lastSale.paymentMethod} />
      <Detail label="Total Amount" value={peso(lastSale.total)} />
      {lastSale.cashReceived !== undefined ? <Detail label="Cash Received" value={peso(lastSale.cashReceived)} /> : null}
      {lastSale.change !== undefined ? <Detail label="Change" value={peso(lastSale.change)} success /> : null}
    </View>
    <PrimaryButton title="View Receipt" icon="receipt-outline" onPress={() => saleId && router.push({ pathname: '/receipt', params: { saleId } })} />
    <SecondaryButton title={action === 'share' ? 'Preparing PDF…' : 'Share Receipt'} icon="share-outline" onPress={() => void runReceiptAction('share')} />
    <SecondaryButton title={action === 'print' ? 'Opening Print…' : 'Print Receipt'} icon="print-outline" onPress={() => void runReceiptAction('print')} />
    <SecondaryButton title="New Sale" onPress={() => router.replace('/(tabs)/pos')} />
  </ScreenContainer>;
}

function Detail({ label, value, success }: { label: string; value: string; success?: boolean }) {
  return <View style={styles.line}><Text style={styles.label}>{label}</Text><Text style={[styles.value, success && { color: colors.success }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  page: { justifyContent: 'center' },
  check: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.success, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center', fontSize: typography.title, color: colors.success, fontWeight: typography.bold },
  id: { textAlign: 'center', color: colors.textMuted },
  details: { gap: spacing.md, backgroundColor: colors.surface, padding: spacing.xl, borderRadius: 16 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  label: { color: colors.textMuted, flex: 1 },
  value: { color: colors.text, fontWeight: typography.bold, flex: 1, textAlign: 'right' },
});
