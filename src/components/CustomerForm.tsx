import { FilterChips } from '@/components/FilterChips';
import { FormField } from '@/components/FormField';
import { PrimaryButton, ScreenContainer, SecondaryButton } from '@/components/ui';
import { spacing, typography } from '@/constants/theme';
import { CustomerInput } from '@/database/repositories/customers';
import { useKeyboardAwareForm } from '@/hooks/useKeyboardAwareForm';
import { createThemedStyles, useAppearance } from '@/store/appearance';
import { Customer, CustomerType, DiscountType } from '@/types';
import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';

type Field = 'name' | 'phone' | 'address' | 'creditLimit' | 'discountValue';
const discountLabels = ['No Discount', 'Percentage', 'Fixed Amount'];

function discountTypeFromLabel(label: string): DiscountType {
  return label === 'Percentage' ? 'percentage' : label === 'Fixed Amount' ? 'fixed' : 'none';
}

function discountLabelFromType(type: DiscountType) {
  return type === 'percentage' ? 'Percentage' : type === 'fixed' ? 'Fixed Amount' : 'No Discount';
}

export function CustomerForm({ customer, onSave }: {
  customer?: Customer;
  onSave: (input: CustomerInput) => Promise<void>;
}) {
  const styles = useStyles();
  const { colors } = useAppearance();
  const form = useKeyboardAwareForm<Field>();
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');
  const [customerType, setCustomerType] = useState<CustomerType>(customer?.customerType ?? 'regular');
  const [discountType, setDiscountType] = useState<DiscountType>(customer?.discountType ?? 'none');
  const [discountValue, setDiscountValue] = useState(customer?.discountValue ? String(customer.discountValue) : '');
  const [allowUtang, setAllowUtang] = useState(customer?.allowUtang ?? false);
  const [creditLimit, setCreditLimit] = useState(customer ? String(customer.creditLimit) : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const changeCustomerType = (label: string) => {
    const next = label === 'Suki' ? 'suki' : 'regular';
    setCustomerType(next);
    if (next === 'regular') { setDiscountType('none'); setDiscountValue(''); }
  };

  const save = async () => {
    const parsedLimit = allowUtang ? Number(creditLimit) : customer?.creditLimit ?? 0;
    const parsedDiscount = discountType === 'none' ? 0 : Number(discountValue);
    if (!name.trim() || !phone.trim()) { setError('Name and phone number are required.'); return; }
    if (allowUtang && (!creditLimit.trim() || !Number.isFinite(parsedLimit) || parsedLimit < 0)) { setError('Enter a credit limit of zero or greater.'); return; }
    if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0) { setError('Enter a valid non-negative discount.'); return; }
    if (discountType === 'percentage' && parsedDiscount > 100) { setError('Percentage discount cannot exceed 100%.'); return; }
    setSaving(true); setError('');
    try {
      await onSave({ name, phone, address, customerType, discountType, discountValue: parsedDiscount, allowUtang, creditLimit: parsedLimit });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Customer could not be saved. Please try again.');
    } finally { setSaving(false); }
  };

  return <ScreenContainer {...form.screenProps}>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <FormField {...form.fieldProps('name')} label="Full Name *" placeholder="Customer name" value={name} onChangeText={setName} returnKeyType="next" onSubmitEditing={() => form.focusField('phone')} />
    <FormField {...form.fieldProps('phone')} label="Phone Number *" placeholder="09XX XXX XXXX" keyboardType="phone-pad" value={phone} onChangeText={setPhone} returnKeyType="next" onSubmitEditing={() => form.focusField('address')} />
    <FormField {...form.fieldProps('address')} label="Address" placeholder="Optional address" multiline value={address} onChangeText={setAddress} />
    <View style={styles.optionGroup}><Text style={styles.label}>Customer Type</Text><FilterChips items={['Regular', 'Suki']} active={customerType === 'suki' ? 'Suki' : 'Regular'} onChange={changeCustomerType} /></View>
    {customerType === 'suki' ? <>
      <View style={styles.optionGroup}><Text style={styles.label}>Default Suki Discount</Text><FilterChips items={discountLabels} active={discountLabelFromType(discountType)} onChange={(label) => { const next = discountTypeFromLabel(label); setDiscountType(next); if (next === 'none') setDiscountValue(''); }} /></View>
      {discountType !== 'none' ? <FormField {...form.fieldProps('discountValue')} label={discountType === 'percentage' ? 'Discount Percentage *' : 'Fixed Discount Amount *'} placeholder="0.00" keyboardType="decimal-pad" value={discountValue} onChangeText={setDiscountValue} returnKeyType="next" onSubmitEditing={() => form.focusField('creditLimit')} /> : null}
    </> : null}
    <View style={styles.toggleRow}><View style={{ flex: 1 }}><Text style={styles.label}>Allow Utang</Text><Text style={styles.help}>Permit this customer to create new credit purchases.</Text></View><Switch accessibilityLabel="Allow Utang" value={allowUtang} onValueChange={setAllowUtang} trackColor={{ false: colors.border, true: colors.primarySoft }} thumbColor={allowUtang ? colors.primary : colors.textMuted} /></View>
    {allowUtang ? <FormField {...form.fieldProps('creditLimit')} label="Credit Limit *" placeholder="0.00" keyboardType="decimal-pad" value={creditLimit} onChangeText={setCreditLimit} /> : null}
    <View style={styles.buttons}><SecondaryButton title="Cancel" onPress={() => router.back()} style={{ flex: 1 }} /><PrimaryButton title={customer ? 'Save Changes' : 'Save Customer'} icon="save-outline" onPress={() => void save()} loading={saving} style={{ flex: 1 }} /></View>
  </ScreenContainer>;
}

const useStyles = createThemedStyles((colors) => ({
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: 12, fontSize: typography.bodySmall },
  optionGroup: { gap: spacing.sm },
  label: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  help: { color: colors.textMuted, fontSize: typography.caption, marginTop: spacing.xs },
  toggleRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  buttons: { flexDirection: 'row', gap: spacing.sm },
}));
