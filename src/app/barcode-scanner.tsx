import { createThemedStyles, useAppearance } from '@/store/appearance';
import { PrimaryButton, SecondaryButton, StatusBadge } from '@/components/ui';
import { ProductImage } from '@/components/ProductImage';
import { radius, shadow, spacing, typography } from '@/constants/theme';
import { useRole } from '@/hooks/useRole';
import { defaultScannerPreferences, getScannerPreferences, ScannerPreferences } from '@/services/appSettings';
import { getScanSoundUri } from '@/services/scanFeedback';
import { useAppStore } from '@/store/app';
import { Product } from '@/types';
import { peso } from '@/utils/format';
import { Ionicons } from '@expo/vector-icons';
import { BarcodeScanningResult, BarcodeType, CameraView, useCameraPermissions } from 'expo-camera';
import { useAudioPlayer } from 'expo-audio';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScannerMode = 'pos' | 'inventory' | 'input';
type ScanState = 'scanning' | 'looking' | 'found' | 'missing' | 'added' | 'error';

const barcodeTypes: BarcodeType[] = [
  'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39',
  'code93', 'itf14', 'codabar', 'qr', 'datamatrix', 'aztec', 'pdf417',
];

function scannerMode(value?: string): ScannerMode {
  return value === 'inventory' || value === 'input' ? value : 'pos';
}

export default function BarcodeScanner() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const mode = scannerMode(modeParam);
  const { cart, addToCart, findProductByBarcode, setPendingScannedBarcode } = useAppStore();
  const { isAdmin } = useRole();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>('scanning');
  const [product, setProduct] = useState<Product | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [torch, setTorch] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [permissionError, setPermissionError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');
  const requestedAutomatically = useRef(false);
  const scanLocked = useRef(false);
  const lookupToken = useRef(0);
  const preferencesRef = useRef<ScannerPreferences>(defaultScannerPreferences);
  const soundUri = useMemo(getScanSoundUri, []);
  const scanSound = useAudioPlayer(soundUri);

  useFocusEffect(useCallback(() => {
    let active = true;
    setIsFocused(true);
    void getScannerPreferences().then((preferences) => {
      if (!active) return;
      preferencesRef.current = preferences;
      setTorch(preferences.torchDefault);
    });
    return () => {
      active = false;
      setIsFocused(false);
      setTorch(false);
      lookupToken.current += 1;
    };
  }, []));

  const playScanFeedback = useCallback(() => {
    const preferences = preferencesRef.current;
    if (preferences.vibrate) Vibration.vibrate(45);
    if (preferences.sound && soundUri) {
      void scanSound.seekTo(0).then(() => scanSound.play()).catch(() => undefined);
    }
  }, [scanSound, soundUri]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const active = nextState === 'active';
      setIsAppActive(active);
      if (!active) setTorch(false);
      else void getPermission().catch(() => setPermissionError('Camera permission status could not be refreshed.'));
    });
    return () => subscription.remove();
  }, [getPermission]);

  useEffect(() => {
    if (!isFocused || !permission || permission.granted || permission.status !== 'undetermined' || requestedAutomatically.current) return;
    requestedAutomatically.current = true;
    void requestPermission().catch(() => setPermissionError('Camera permission could not be requested. Please try again.'));
  }, [isFocused, permission, requestPermission]);

  const retryPermission = async () => {
    setPermissionError('');
    try {
      await requestPermission();
    } catch {
      setPermissionError('Camera permission could not be requested. Please try again.');
    }
  };

  const resetScanner = useCallback(() => {
    lookupToken.current += 1;
    scanLocked.current = false;
    setState('scanning');
    setProduct(null);
    setScannedBarcode('');
    setQuantity(1);
    setTorch(preferencesRef.current.torchDefault);
    setCameraReady(false);
    setCameraError('');
  }, []);

  const handleBarcodeScanned = useCallback(async ({ data }: BarcodeScanningResult) => {
    if (scanLocked.current) return;
    scanLocked.current = true;
    setTorch(false);
    const barcode = data.trim();
    if (!barcode) {
      setCameraError('The camera detected an empty barcode. Please scan again.');
      setState('error');
      return;
    }

    playScanFeedback();
    setScannedBarcode(barcode);
    if (mode === 'input') {
      setPendingScannedBarcode(barcode);
      router.back();
      return;
    }

    setState('looking');
    const token = ++lookupToken.current;
    try {
      const match = await findProductByBarcode(barcode);
      if (token !== lookupToken.current) return;
      if (!match) {
        setState('missing');
        return;
      }
      if (mode === 'inventory') {
        router.replace({ pathname: '/product-details', params: { id: match.id } });
        return;
      }
      const quantityAlreadyInCart = cart.find((item) => item.productId === match.id)?.quantity ?? 0;
      if (preferencesRef.current.autoAdd && match.stock > quantityAlreadyInCart) {
        addToCart(match.id, 1);
        setProduct(match);
        setQuantity(1);
        setState('added');
        return;
      }
      setProduct(match);
      setQuantity(1);
      setState('found');
    } catch {
      if (token !== lookupToken.current) return;
      setCameraError('The local product database could not be searched. Please try again.');
      setState('error');
    }
  }, [addToCart, cart, findProductByBarcode, mode, playScanFeedback, setPendingScannedBarcode]);

  if (!permission) {
    return <CenteredMessage icon="camera-outline" title="Preparing camera" message="Checking camera permission…" loading />;
  }

  if (!permission.granted) {
    const permanentlyDenied = !permission.canAskAgain;
    return (
      <CenteredMessage
        icon="camera-outline"
        title="Camera access required"
        message={permanentlyDenied
          ? 'Camera permission is disabled. Enable it for Sari-sari Store in Android Settings, then return here.'
          : 'Camera access is required to scan product barcodes. Your photos and videos are not saved.'}
        error={permissionError}
      >
        {permanentlyDenied
          ? <PrimaryButton title="Open Android Settings" icon="settings-outline" onPress={() => void Linking.openSettings().catch(() => Alert.alert('Unable to open Settings', 'Open Android Settings and enable Camera permission for Sari-sari Store.'))} />
          : <PrimaryButton title="Retry Permission" icon="camera-outline" onPress={() => void retryPermission()} />}
      </CenteredMessage>
    );
  }

  const cameraActive = isFocused && isAppActive && state === 'scanning' && !cameraError;
  if (state === 'scanning') {
    return (
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.scannerPage}>
        <View style={styles.cameraStage}>
          {cameraActive ? (
            <CameraView
              barcodeScannerSettings={{ barcodeTypes }}
              enableTorch={torch}
              facing="back"
              onBarcodeScanned={handleBarcodeScanned}
              onCameraReady={() => setCameraReady(true)}
              onMountError={(event) => {
                setCameraError(event.message || 'The camera is unavailable on this device.');
                setState('error');
              }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={styles.pausedCamera}>
              <Ionicons name="camera-outline" size={54} color={colors.white} />
              <Text style={styles.pausedText}>{isAppActive ? 'Starting camera…' : 'Camera paused while the app is in the background'}</Text>
            </View>
          )}
          <View pointerEvents="none" style={styles.overlay}>
            <View style={styles.scanStatus}><View style={styles.liveDot} /><Text style={styles.scanStatusText}>Scanning</Text></View>
            <View style={styles.frame}><View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} /><View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} /></View>
            <Text style={styles.help}>Align the barcode inside the frame</Text>
          </View>
          <Pressable
            accessibilityLabel={torch ? 'Turn flashlight off' : 'Turn flashlight on'}
            accessibilityRole="button"
            disabled={!cameraReady}
            hitSlop={8}
            onPress={() => setTorch((value) => !value)}
            style={({ pressed }) => [styles.flash, torch && styles.flashOn, !cameraReady && styles.disabled, pressed && styles.pressed]}
          >
            <Ionicons name={torch ? 'flash' : 'flash-off'} size={23} color={torch ? colors.primary : colors.white} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'looking') {
    return <CenteredMessage icon="search-outline" title="Looking up product" message={`Searching this device for ${scannedBarcode}`} loading />;
  }

  if (state === 'missing') {
    return (
      <CenteredMessage icon="help-circle-outline" title="Product not found" message="This barcode is not registered in the local inventory.">
        <View style={styles.barcodeCard}><Text style={styles.fieldLabel}>Scanned barcode</Text><Text selectable style={styles.barcodeText}>{scannedBarcode}</Text></View>
        {isAdmin ? <PrimaryButton title="Add New Product" icon="add-circle-outline" onPress={() => { setPendingScannedBarcode(scannedBarcode); router.replace('/add-product'); }} /> : null}
        <SecondaryButton title="Scan Again" icon="scan-outline" onPress={resetScanner} />
      </CenteredMessage>
    );
  }

  if (state === 'error' || !product) {
    return (
      <CenteredMessage icon="warning-outline" title="Scanner unavailable" message={cameraError || 'The barcode could not be processed.'}>
        <PrimaryButton title="Try Again" icon="scan-outline" onPress={resetScanner} />
      </CenteredMessage>
    );
  }

  const quantityAlreadyInCart = cart.find((item) => item.productId === product.id)?.quantity ?? 0;
  const remainingStock = Math.max(0, product.stock - quantityAlreadyInCart);
  const canAdd = product.stock > 0 && remainingStock > 0;
  const maximumQuantity = Math.max(1, remainingStock);

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.resultSafe}>
      <ScrollView contentContainerStyle={styles.resultPage}>
        <View style={styles.productCard}>
          <View style={styles.resultTop}>
            <ProductImage uri={product.imageUri} fallback={product.icon} size={86} />
            <View style={styles.productHeading}>
              <StatusBadge label={product.stock > 0 ? 'Product Found' : 'Out of Stock'} tone={product.stock > 0 ? 'success' : 'danger'} />
              <Text style={styles.name}>{product.name}</Text>
              <Text style={styles.category}>{product.category}</Text>
            </View>
          </View>
          <View style={styles.details}>
            <Detail label="Selling Price" value={peso(product.price)} />
            <Detail label="Current Stock" value={String(product.stock)} />
            <Detail label="Barcode" value={product.barcode} wide />
            {quantityAlreadyInCart > 0 ? <Detail label="Already in Cart" value={String(quantityAlreadyInCart)} /> : null}
          </View>
          {state === 'added' ? (
            <View style={styles.confirmation}>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text style={styles.confirmationText}>{quantity} {quantity === 1 ? 'item' : 'items'} added to cart.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.quantityLabel}>Quantity</Text>
              <View style={styles.qty}>
                <Pressable accessibilityLabel="Decrease quantity" disabled={quantity <= 1} hitSlop={8} onPress={() => setQuantity((value) => Math.max(1, value - 1))} style={quantity <= 1 && styles.disabled}>
                  <Ionicons name="remove-circle-outline" size={34} color={colors.primary} />
                </Pressable>
                <Text style={styles.qtyText}>{quantity}</Text>
                <Pressable accessibilityLabel="Increase quantity" disabled={!canAdd || quantity >= maximumQuantity} hitSlop={8} onPress={() => setQuantity((value) => Math.min(maximumQuantity, value + 1))} style={(!canAdd || quantity >= maximumQuantity) && styles.disabled}>
                  <Ionicons name="add-circle-outline" size={34} color={colors.primary} />
                </Pressable>
              </View>
              {!canAdd ? <Text style={styles.stockWarning}>{product.stock === 0 ? 'This product is out of stock.' : 'All available stock is already in the cart.'}</Text> : null}
            </>
          )}
        </View>
        {state === 'added' ? (
          <>
            <PrimaryButton title="Go to Cart" icon="cart-outline" onPress={() => router.replace('/cart')} />
            <SecondaryButton title="Scan Another Product" icon="scan-outline" onPress={resetScanner} />
          </>
        ) : (
          <>
            <PrimaryButton title={`Add to Cart · ${peso(product.price * quantity)}`} icon="cart-outline" disabled={!canAdd} onPress={() => { addToCart(product.id, quantity); setState('added'); }} />
            <SecondaryButton title="Scan Again" icon="scan-outline" onPress={resetScanner} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CenteredMessage({ children, error, icon, loading, message, title }: { children?: React.ReactNode; error?: string; icon: keyof typeof Ionicons.glyphMap; loading?: boolean; message: string; title: string }) {
  const { colors } = useAppearance();
  const styles = useStyles();
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.messageSafe}>
      <View style={styles.messageCard}>
        {loading ? <ActivityIndicator size="large" color={colors.primary} /> : <View style={styles.messageIcon}><Ionicons name={icon} size={42} color={colors.primary} /></View>}
        <Text style={styles.messageTitle}>{title}</Text>
        <Text style={styles.messageText}>{message}</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {children ? <View style={styles.messageActions}>{children}</View> : null}
      </View>
    </SafeAreaView>
  );
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {  const styles = useStyles();
  return <View style={[styles.detail, wide && styles.detailWide]}><Text style={styles.fieldLabel}>{label}</Text><Text selectable={label === 'Barcode'} style={styles.detailValue}>{value}</Text></View>;
}

const useStyles = createThemedStyles((colors) => ({
  scannerPage: { flex: 1, backgroundColor: '#05070B' },
  cameraStage: { flex: 1, backgroundColor: '#05070B', overflow: 'hidden' },
  pausedCamera: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  pausedText: { color: colors.white, textAlign: 'center', fontSize: typography.body },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  scanStatus: { position: 'absolute', top: spacing.xl, left: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  scanStatusText: { color: colors.white, fontWeight: typography.semibold, fontSize: typography.bodySmall },
  frame: { width: '88%', maxWidth: 360, height: 190, position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: colors.white },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: radius.md },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: radius.md },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: radius.md },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: radius.md },
  help: { position: 'absolute', bottom: spacing.xxxl, color: colors.white, backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, fontSize: typography.bodySmall, overflow: 'hidden' },
  flash: { position: 'absolute', top: spacing.lg, right: spacing.lg, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.58)', alignItems: 'center', justifyContent: 'center' },
  flashOn: { backgroundColor: colors.white },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.38 },
  messageSafe: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center' },
  messageCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl, alignItems: 'center', gap: spacing.md, ...shadow },
  messageIcon: { width: 78, height: 78, borderRadius: 39, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  messageTitle: { color: colors.text, fontSize: typography.title, fontWeight: typography.bold, textAlign: 'center' },
  messageText: { color: colors.textMuted, fontSize: typography.body, lineHeight: 22, textAlign: 'center' },
  errorText: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radius.md, alignSelf: 'stretch', textAlign: 'center' },
  messageActions: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.sm },
  barcodeCard: { alignSelf: 'stretch', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  barcodeText: { color: colors.text, fontSize: typography.subtitle, fontWeight: typography.semibold, textAlign: 'center' },
  resultSafe: { flex: 1, backgroundColor: colors.background },
  resultPage: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  productCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.lg, ...shadow },
  resultTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  productHeading: { flex: 1, alignItems: 'flex-start' },
  name: { color: colors.text, fontWeight: typography.bold, fontSize: typography.title, marginTop: spacing.sm },
  category: { color: colors.textMuted, marginTop: spacing.xs },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  detail: { width: '48%', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  detailWide: { width: '100%' },
  fieldLabel: { color: colors.textMuted, fontSize: typography.caption, fontWeight: typography.semibold },
  detailValue: { color: colors.text, fontSize: typography.body, fontWeight: typography.semibold },
  quantityLabel: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.semibold, textAlign: 'center' },
  qty: { flexDirection: 'row', gap: spacing.xxl, alignItems: 'center', justifyContent: 'center' },
  qtyText: { minWidth: 38, color: colors.text, fontWeight: typography.bold, fontSize: typography.title, textAlign: 'center' },
  stockWarning: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, textAlign: 'center' },
  confirmation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.successSoft, borderRadius: radius.md, padding: spacing.md },
  confirmationText: { color: colors.success, fontWeight: typography.semibold },
}));
