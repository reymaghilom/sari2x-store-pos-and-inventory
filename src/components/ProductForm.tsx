import { createThemedStyles, useAppearance } from '@/store/appearance';
import { FormField } from '@/components/FormField';
import { ProductImage } from '@/components/ProductImage';
import { ProductImageCropper } from '@/components/ProductImageCropper';
import { PrimaryButton, ScreenContainer, SecondaryButton } from '@/components/ui';
import { radius, spacing, typography } from '@/constants/theme';
import { isBarcodeConflictError } from '@/database/repositories/products';
import { useKeyboardAwareForm } from '@/hooks/useKeyboardAwareForm';
import { deleteProductImage, deleteTemporaryImage, persistProductImage } from '@/services/productImages';
import { useAppStore } from '@/store/app';
import { Product } from '@/types';
import { cropOutputSize, cropRectangleForTransform, CropTransform } from '@/utils/imageCrop';
import { Ionicons } from '@expo/vector-icons';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, Switch, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

type ProductField = 'name' | 'category' | 'price' | 'costPrice' | 'stock' | 'barcode' | 'threshold' | 'description';
type FieldErrors = Partial<Record<ProductField, string>>;
type PendingProductImage = { uri: string; width: number; height: number };

const INITIAL_CROP_TRANSFORM: CropTransform = { translateX: 0, translateY: 0, zoom: 1 };

export function ProductForm({ product }: { product?: Product }) {
  const { colors } = useAppearance();
  const styles = useStyles();
  const window = useWindowDimensions();
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
  const [imageUri, setImageUri] = useState<string | undefined>(product?.imageUri);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectingImage, setSelectingImage] = useState(false);
  const [usingImage, setUsingImage] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingProductImage | null>(null);
  const [cropResetSignal, setCropResetSignal] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const stagedImageUri = useRef<string | null>(null);
  const pendingImageUri = useRef<string | null>(null);
  const cropTransform = useRef<CropTransform>(INITIAL_CROP_TRANSFORM);
  const keyboardForm = useKeyboardAwareForm<ProductField>();
  const edit = Boolean(product);

  useEffect(() => {
    if (!pendingScannedBarcode) return;
    setBarcode(pendingScannedBarcode);
    setFieldErrors((current) => ({ ...current, barcode: undefined }));
    setError('');
    setPendingScannedBarcode(null);
  }, [pendingScannedBarcode, setPendingScannedBarcode]);

  useEffect(() => () => {
    try { deleteProductImage(stagedImageUri.current); } catch (cleanupError) { console.warn('Unused product image could not be removed', cleanupError); }
    try { deleteTemporaryImage(pendingImageUri.current); } catch (cleanupError) { console.warn('Temporary product image could not be removed', cleanupError); }
  }, []);

  const discardPendingImage = useCallback(() => {
    try { deleteTemporaryImage(pendingImageUri.current); } catch (cleanupError) { console.warn('Temporary product image could not be removed', cleanupError); }
    pendingImageUri.current = null;
    cropTransform.current = INITIAL_CROP_TRANSFORM;
    setPendingImage(null);
  }, []);

  const resetCrop = useCallback(() => {
    cropTransform.current = INITIAL_CROP_TRANSFORM;
    setCropResetSignal((value) => value + 1);
  }, []);

  const updateCropTransform = useCallback((transform: CropTransform) => {
    cropTransform.current = transform;
  }, []);

  const clearFieldError = (field: ProductField) => {
    setFieldErrors((current) => current[field] ? { ...current, [field]: undefined } : current);
    setError('');
  };

  const openBarcodeScanner = () => {
    setPendingScannedBarcode(null);
    router.push({ pathname: '/barcode-scanner', params: { mode: 'input' } });
  };

  const chooseImage = async () => {
    if (selectingImage) return;
    setSelectingImage(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access needed', 'Allow photo access in Android Settings to select a product image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1, allowsMultipleSelection: false, selectionLimit: 1 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.type && asset.type !== 'image') throw new Error('Please select an image file.');
      const normalized = await manipulateAsync(asset.uri, [], { compress: 1, format: SaveFormat.JPEG });
      if (normalized.width <= 0 || normalized.height <= 0) throw new Error('The selected image has invalid dimensions.');
      const previousPendingUri = pendingImageUri.current;
      pendingImageUri.current = normalized.uri;
      cropTransform.current = INITIAL_CROP_TRANSFORM;
      setCropResetSignal((value) => value + 1);
      setPendingImage({ uri: normalized.uri, width: normalized.width, height: normalized.height });
      if (previousPendingUri && previousPendingUri !== normalized.uri) deleteTemporaryImage(previousPendingUri);
    } catch (imageError) {
      Alert.alert('Image not selected', imageError instanceof Error ? imageError.message : 'The selected image could not be opened. Please try another image.');
    } finally {
      setSelectingImage(false);
    }
  };

  const applyPendingImage = async () => {
    if (!pendingImage || usingImage) return;
    setUsingImage(true);
    let croppedTemporaryUri: string | null = null;
    try {
      const crop = cropRectangleForTransform(pendingImage.width, pendingImage.height, cropFrameSize, cropTransform.current);
      const outputSize = cropOutputSize(crop);
      const cropped = await manipulateAsync(
        pendingImage.uri,
        [{ crop }, { resize: { width: outputSize, height: outputSize } }],
        { compress: 0.85, format: SaveFormat.JPEG },
      );
      croppedTemporaryUri = cropped.uri;
      const persistedUri = persistProductImage(cropped.uri, 'product-photo.jpg', 'image/jpeg');
      const previousStagedUri = stagedImageUri.current;
      stagedImageUri.current = persistedUri;
      setImageUri(persistedUri);
      if (previousStagedUri && previousStagedUri !== persistedUri) deleteProductImage(previousStagedUri);
      discardPendingImage();
    } catch (imageError) {
      Alert.alert('Photo not saved', imageError instanceof Error ? imageError.message : 'The cropped image could not be saved. Please try again.');
    } finally {
      try { deleteTemporaryImage(croppedTemporaryUri); } catch (cleanupError) { console.warn('Temporary cropped image could not be removed', cleanupError); }
      setUsingImage(false);
    }
  };

  const cropFrameSize = Math.max(140, Math.min(420, window.width - spacing.lg * 2, window.height - 330));

  const cancel = () => {
    try { deleteProductImage(stagedImageUri.current); } catch (cleanupError) { console.warn('Unused product image could not be removed', cleanupError); }
    stagedImageUri.current = null;
    router.back();
  };

  const save = async () => {
    const numericPrice = Number(price);
    const numericCost = Number(costPrice);
    const numericStock = Number(stock);
    const numericThreshold = Number(threshold);
    const validation: FieldErrors = {};
    if (!name.trim()) validation.name = 'Product name is required.';
    if (!category.trim()) validation.category = 'Category is required.';
    if (!price.trim() || !Number.isFinite(numericPrice) || numericPrice <= 0) validation.price = 'Enter a selling price greater than zero.';
    if (costPrice.trim() && (!Number.isFinite(numericCost) || numericCost < 0)) validation.costPrice = 'Enter a valid cost price of zero or greater.';
    if (!edit && (!stock.trim() || !Number.isInteger(numericStock) || numericStock < 0)) validation.stock = 'Enter a whole-number stock quantity of zero or greater.';
    if (lowAlert && (!threshold.trim() || !Number.isInteger(numericThreshold) || numericThreshold < 0)) validation.threshold = 'Enter a whole-number threshold of zero or greater.';
    const firstInvalidField = (['name', 'category', 'price', 'costPrice', 'stock', 'barcode', 'threshold', 'description'] as ProductField[]).find((field) => validation[field]);
    if (firstInvalidField) {
      setFieldErrors(validation);
      setError('Please correct the highlighted field before saving.');
      keyboardForm.focusField(firstInvalidField);
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
      imageUri: imageUri ?? null,
    };
    setSaving(true);
    setError('');
    try {
      if (product) {
        await updateProduct(product.id, input);
        stagedImageUri.current = null;
        Alert.alert('Product updated', `${input.name} was saved offline.`);
        router.replace({ pathname: '/product-details', params: { id: product.id } });
      } else {
        await addProduct(input);
        stagedImageUri.current = null;
        router.replace('/(tabs)/inventory');
      }
    } catch (saveError) {
      if (isBarcodeConflictError(saveError)) {
        const barcodeError = 'This barcode is already assigned to another product.';
        setFieldErrors((current) => ({ ...current, barcode: barcodeError }));
        setError(barcodeError);
        keyboardForm.focusField('barcode');
      } else {
        setError('Product could not be saved. Please check the product details and try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer {...keyboardForm.screenProps}>
      <View style={styles.image}>
        <ProductImage uri={imageUri} fallback={product?.icon} size={72} />
        <View style={styles.imageCopy}><Text style={styles.imageTitle}>Product Image</Text><Text style={styles.imageSub}>{imageUri ? 'Saved on this phone' : 'Choose one image from your gallery'}</Text></View>
        <SecondaryButton title={selectingImage ? 'Opening…' : imageUri ? 'Change' : 'Upload'} onPress={() => void chooseImage()} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FormField {...keyboardForm.fieldProps('name')} error={fieldErrors.name} label="Product Name *" placeholder="e.g. Coca-Cola 1.5L" value={name} onChangeText={(value) => { setName(value); clearFieldError('name'); }} />
      <FormField {...keyboardForm.fieldProps('category')} error={fieldErrors.category} label="Category *" placeholder="e.g. Beverages" value={category} onChangeText={(value) => { setCategory(value); clearFieldError('category'); }} />
      <View style={styles.row}>
        <View style={styles.flex}><FormField {...keyboardForm.fieldProps('price')} error={fieldErrors.price} label="Selling Price *" placeholder="0.00" keyboardType="decimal-pad" value={price} onChangeText={(value) => { setPrice(value); clearFieldError('price'); }} /></View>
        <View style={styles.flex}><FormField {...keyboardForm.fieldProps('costPrice')} error={fieldErrors.costPrice} label="Cost Price" placeholder="0.00" keyboardType="decimal-pad" value={costPrice} onChangeText={(value) => { setCostPrice(value); clearFieldError('costPrice'); }} /></View>
      </View>
      {!edit ? <FormField {...keyboardForm.fieldProps('stock')} error={fieldErrors.stock} label="Initial Stock *" placeholder="0" keyboardType="number-pad" value={stock} onChangeText={(value) => { setStock(value); clearFieldError('stock'); }} /> : null}
      <View style={styles.barcodeRow}>
        <View style={styles.flex}><FormField {...keyboardForm.fieldProps('barcode')} error={fieldErrors.barcode} label="Barcode" placeholder="Enter or scan barcode" value={barcode} onChangeText={(value) => { setBarcode(value); clearFieldError('barcode'); }} /></View>
        <SecondaryButton title="Scan" icon="scan-outline" onPress={openBarcodeScanner} style={styles.scanButton} />
      </View>
      <View style={styles.alert}>
        <View style={styles.flex}><Text style={styles.alertTitle}>Low Stock Alert</Text><Text style={styles.alertText}>Notify when inventory runs low</Text></View>
        <Switch value={lowAlert} onValueChange={setLowAlert} trackColor={{ true: colors.primary }} />
      </View>
      {lowAlert ? <FormField {...keyboardForm.fieldProps('threshold')} error={fieldErrors.threshold} label="Low Stock Threshold" placeholder="10" keyboardType="number-pad" value={threshold} onChangeText={(value) => { setThreshold(value); clearFieldError('threshold'); }} /> : null}
      <FormField {...keyboardForm.fieldProps('description')} error={fieldErrors.description} label="Description" placeholder="Product description" multiline numberOfLines={3} value={description} onChangeText={(value) => { setDescription(value); clearFieldError('description'); }} />
      <View style={styles.buttons}>
        <SecondaryButton title="Cancel" onPress={cancel} style={styles.flex} />
        <PrimaryButton title={edit ? 'Save Changes' : 'Save Product'} icon="save-outline" onPress={() => void save()} loading={saving} style={styles.flex} />
      </View>
      <Modal animationType="slide" presentationStyle="fullScreen" statusBarTranslucent visible={Boolean(pendingImage)} onRequestClose={discardPendingImage}>
        <GestureHandlerRootView style={styles.reviewRoot}>
          <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.reviewSafe}>
            <View style={styles.reviewHeader}>
              <Pressable accessibilityLabel="Cancel photo selection" accessibilityRole="button" hitSlop={8} onPress={discardPendingImage} style={({ pressed }) => [styles.reviewBack, pressed && styles.pressed]}>
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
                <Text style={styles.reviewBackText}>Back</Text>
              </Pressable>
              <Text style={styles.reviewTitle}>Adjust Product Photo</Text>
              <View style={styles.reviewHeaderSpacer} />
            </View>
            <View style={styles.reviewBody}>
              {pendingImage ? <ProductImageCropper uri={pendingImage.uri} sourceWidth={pendingImage.width} sourceHeight={pendingImage.height} frameSize={cropFrameSize} resetSignal={cropResetSignal} onTransformChange={updateCropTransform} /> : null}
              <Text style={styles.reviewHelp}>Drag to reposition. Pinch with two fingers to zoom. The square frame is the saved photo.</Text>
            </View>
            <View style={styles.reviewFooter}>
              <View style={styles.reviewButtonRow}>
                <SecondaryButton title="Cancel" icon="close-outline" onPress={discardPendingImage} style={styles.flex} />
                <SecondaryButton title="Reset" icon="refresh-outline" onPress={resetCrop} style={styles.flex} />
              </View>
              <View style={styles.reviewButtonRow}>
                <SecondaryButton title={selectingImage ? 'Opening…' : 'Choose Another'} icon="images-outline" onPress={() => void chooseImage()} style={styles.flex} />
                <PrimaryButton title="Use Photo" icon="checkmark-circle-outline" loading={usingImage} onPress={() => void applyPendingImage()} style={styles.flex} />
              </View>
            </View>
          </SafeAreaView>
        </GestureHandlerRootView>
      </Modal>
    </ScreenContainer>
  );
}

const useStyles = createThemedStyles((colors) => ({
  image: { minHeight: 104, flexDirection: 'row', gap: spacing.md, alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg },
  imageCopy: { flex: 1 },
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
  reviewRoot: { flex: 1 },
  reviewSafe: { flex: 1, backgroundColor: colors.surface },
  reviewHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: spacing.md },
  reviewBack: { minWidth: 88, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  reviewBackText: { color: colors.primary, fontSize: typography.body, fontWeight: typography.semibold },
  reviewTitle: { flex: 1, color: colors.text, fontSize: typography.subtitle, fontWeight: typography.bold, textAlign: 'center' },
  reviewHeaderSpacer: { width: 88 },
  reviewBody: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  reviewFooter: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, backgroundColor: colors.surface },
  reviewButtonRow: { flexDirection: 'row', gap: spacing.sm },
  reviewHelp: { color: colors.textMuted, fontSize: typography.bodySmall, lineHeight: 20, textAlign: 'center' },
  pressed: { opacity: 0.72 },
}));
