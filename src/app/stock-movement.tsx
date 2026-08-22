import { createThemedStyles } from '@/store/appearance';
import { FilterChips } from '@/components/FilterChips';
import { FormField } from '@/components/FormField';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { PrimaryButton, ScreenContainer } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { useKeyboardAwareForm } from '@/hooks/useKeyboardAwareForm';
import { useRole } from '@/hooks/useRole';
import { useAppStore } from '@/store/app';
import { useAuth } from '@/store/auth';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

export default function StockMovement() {  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id?: string }>(); const { products, adjustStock } = useAppStore(); const { user } = useAuth(); const { isOwner } = useRole();
  const keyboardForm = useKeyboardAwareForm<'quantity' | 'reference' | 'notes'>();
  const product = products.find((item) => item.id === id) ?? products[0];
  const [mode, setMode] = useState('Stock In'); const [quantity, setQuantity] = useState(''); const [reference, setReference] = useState(''); const [notes, setNotes] = useState(''); const [reason, setReason] = useState('Damaged'); const [saving, setSaving] = useState(false);
  if (!isOwner) return <PlaceholderScreen title="Owner access required" description="Unlock the app as Owner to record stock movements." icon="lock-closed-outline" />;
  const save = async () => { const value = Number(quantity); if (!Number.isInteger(value) || value <= 0) { Alert.alert('Invalid quantity', 'Enter a whole number greater than zero.'); keyboardForm.focusField('quantity'); return; } setSaving(true); const success = await adjustStock(product.id, mode === 'Stock In' ? value : -value, { reason: mode === 'Stock In' ? 'Stock In' : reason, reference, notes, createdBy: user?.id }); setSaving(false); if (!success) { Alert.alert('Stock update failed', `Check the quantity and try again. Current stock is ${product.stock}.`); return; } Alert.alert('Stock updated', `${product.name} was ${mode === 'Stock In' ? 'increased' : 'decreased'} by ${value}.`, [{ text: 'Done', onPress: () => router.replace({ pathname: '/product-details', params: { id: product.id } }) }]); };
  return <ScreenContainer {...keyboardForm.screenProps}><FilterChips items={['Stock In', 'Stock Out']} active={mode} onChange={setMode} /><View style={styles.product}><Text style={styles.emoji}>{product.icon}</Text><View><Text style={styles.name}>{product.name}</Text><Text style={styles.stock}>Current stock: {product.stock}</Text></View></View><FormField {...keyboardForm.fieldProps('quantity')} label="Quantity *" placeholder="0" keyboardType="number-pad" value={quantity} onChangeText={setQuantity} />{mode === 'Stock Out' ? <><Text style={styles.label}>Reason</Text><FilterChips items={['Damaged', 'Expired', 'Personal Use', 'Correction', 'Other']} active={reason} onChange={setReason} /></> : null}<FormField {...keyboardForm.fieldProps('reference')} label="Reference" placeholder="Purchase order or reference" value={reference} onChangeText={setReference} /><FormField {...keyboardForm.fieldProps('notes')} label="Notes" placeholder="Add notes" multiline numberOfLines={4} value={notes} onChangeText={setNotes} /><PrimaryButton title="Save Movement" icon="save-outline" onPress={() => void save()} loading={saving} /></ScreenContainer>;
}
const useStyles = createThemedStyles((colors) => ({ product: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg }, emoji: { fontSize: 42 }, name: { color: colors.text, fontWeight: typography.bold }, stock: { color: colors.textMuted, fontSize: typography.bodySmall, marginTop: spacing.xs }, label: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.semibold } }));
