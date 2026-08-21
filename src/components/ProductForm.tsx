import { FormField } from '@/components/FormField';
import { PrimaryButton, ScreenContainer, SecondaryButton } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { isBarcodeConflictError } from '@/database/repositories/products';
import { useAppStore } from '@/store/app';
import { Product } from '@/types';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

export function ProductForm({ product }: { product?: Product }) {
  const { addProduct, pendingScannedBarcode, setPendingScannedBarcode, updateProduct } = useAppStore();
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [costPrice, setCostPrice] = useState(product ? String(product.costPrice) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [lowAlert, setLowAlert] = useState(true);
  const [threshold, setThreshold] = useState(product ? String(product.lowStockThreshold) : '10');
  const [description, setDescription] = useState(product?.description ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const edit = Boolean(product);

  useEffect(() => {
    if (!pendingScannedBarcode) return;
    setBarcode(pendingScannedBarcode);
    setError('');
    setPendingScannedBarcode(null);
  }, [pendingScannedBarcode, setPendingScannedBarcode]);

  const openBarcodeScanner = () => {
    setPendingScannedBarcode(null);
    router.push({ pathname: '/barcode-scanner', params: { mode: 'input' } });
  };

  const save = async () => {
    const numericPrice = Number(price);
    const numericCost = Number(costPrice);
    const numericStock = Number(stock);
    const numericThreshold = Number(threshold);
    if (!name.trim() || !category.trim() || !numericPrice || (!edit && (!Number.isFinite(numericStock) || numericStock < 0))) {
      setError('Complete the required fields with valid values.');
      return;
    }
    const input = {
      name: name.trim(),
      category: category.trim(),
      price: numericPrice,
      costPrice: numericCost || 0,
      stock: edit ? undefined : numericStock,
      barcode: barcode.trim(),
      lowStockThreshold: lowAlert ? numericThreshold || 0 : 0,
      description: description.trim(),
    };
    setSaving(true);
    setError('');
    try {
      if (product) {
        await updateProduct(product.id, input);
        Alert.alert('Product updated', `${input.name} was saved offline.`);
        router.replace({ pathname: '/product-details', params: { id: product.id } });
      } else {
        const created = await addProduct(input);
        router.replace({ pathname: '/product-details', params: { id: created.id } });
      }
    } catch (saveError) {
      setError(isBarcodeConflictError(saveError)
        ? 'This barcode is already assigned to another product.'
        : 'Product could not be saved. Please check the product details and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.image}>
        <Text style={styles.emoji}>{product?.icon ?? '📦'}</Text>
        <View style={styles.imageCopy}><Text style={styles.imageTitle}>Product Image</Text><Text style={styles.imageSub}>Placeholder for this phase</Text></View>
        <SecondaryButton title="Upload" />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FormField label="Product Name *" placeholder="e.g. Coca-Cola 1.5L" value={name} onChangeText={setName} />
      <FormField label="Category *" placeholder="e.g. Beverages" value={category} onChangeText={setCategory} />
      <View style={styles.row}>
        <View style={styles.flex}><FormField label="Selling Price *" placeholder="0.00" keyboardType="decimal-pad" value={price} onChangeText={setPrice} /></View>
        <View style={styles.flex}><FormField label="Cost Price" placeholder="0.00" keyboardType="decimal-pad" value={costPrice} onChangeText={setCostPrice} /></View>
      </View>
      {!edit ? <FormField label="Initial Stock *" placeholder="0" keyboardType="number-pad" value={stock} onChangeText={setStock} /> : null}
      <View style={styles.barcodeRow}>
        <View style={styles.flex}><FormField label="Barcode" placeholder="Enter or scan barcode" value={barcode} onChangeText={setBarcode} /></View>
        <SecondaryButton title="Scan" icon="scan-outline" onPress={openBarcodeScanner} style={styles.scanButton} />
      </View>
      <View style={styles.alert}>
        <View style={styles.flex}><Text style={styles.alertTitle}>Low Stock Alert</Text><Text style={styles.alertText}>Notify when inventory runs low</Text></View>
        <Switch value={lowAlert} onValueChange={setLowAlert} trackColor={{ true: colors.primary }} />
      </View>
      {lowAlert ? <FormField label="Low Stock Threshold" placeholder="10" keyboardType="number-pad" value={threshold} onChangeText={setThreshold} /> : null}
      <FormField label="Description" placeholder="Product description" multiline numberOfLines={3} value={description} onChangeText={setDescription} />
      <View style={styles.buttons}>
        <SecondaryButton title="Cancel" onPress={() => router.back()} style={styles.flex} />
        <PrimaryButton title={edit ? 'Save Changes' : 'Save Product'} icon="save-outline" onPress={() => void save()} loading={saving} style={styles.flex} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  image: { minHeight: 104, flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg },
  imageCopy: { flex: 1 },
  emoji: { fontSize: 50 },
  imageTitle: { color: colors.text, fontWeight: typography.semibold },
  imageSub: { color: colors.textMuted, fontSize: typography.caption, marginTop: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.md },
  barcodeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end' },
  scanButton: { minWidth: 92 },
  flex: { flex: 1 },
  alert: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md },
  alertTitle: { color: colors.text, fontWeight: typography.semibold },
  alertText: { color: colors.textMuted, fontSize: typography.bodySmall, marginTop: spacing.xs },
  buttons: { flexDirection: 'row', gap: spacing.sm },
  error: { color: colors.danger, fontSize: typography.bodySmall, backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radius.md },
});
