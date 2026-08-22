import { createThemedStyles, useAppearance } from '@/store/appearance';
import { radius, shadow, spacing, typography } from '@/constants/theme';
import { OWNER_PIN_LENGTH } from '@/database/repositories/users';
import { useAuth } from '@/store/auth';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const keyRows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', 'backspace']];

export default function LoginScreen() {
  const { colors } = useAppearance();
  const styles = useStyles();
  const { unlock } = useAuth();
  const { width, height } = useWindowDimensions();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pinRef = useRef('');
  const attempting = useRef(false);
  const compact = height < 680;
  const keySize = Math.min(compact ? 50 : 56, Math.max(46, Math.floor((width - 80) / 3)));

  const updatePin = (value: string) => { pinRef.current = value; setPin(value); };
  const submit = async (candidate = pinRef.current) => {
    if (attempting.current || candidate.length !== OWNER_PIN_LENGTH) return;
    attempting.current = true;
    setLoading(true);
    try {
      const success = await unlock(candidate);
      if (success) { setError(''); updatePin(''); }
      else { updatePin(''); setError('Incorrect PIN'); }
    } finally {
      attempting.current = false;
      setLoading(false);
    }
  };
  const pressKey = (key: string) => {
    if (attempting.current) return;
    setError('');
    if (key === 'backspace') { updatePin(pinRef.current.slice(0, -1)); return; }
    if (!/^\d$/.test(key) || pinRef.current.length >= OWNER_PIN_LENGTH) return;
    const nextPin = pinRef.current + key;
    updatePin(nextPin);
    if (nextPin.length === OWNER_PIN_LENGTH) void submit(nextPin);
  };

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safe}>
      <View style={[styles.screen, compact && styles.screenCompact]}>
        <View style={styles.header}>
          <View style={[styles.logo, compact && styles.logoCompact]}><Ionicons name="storefront" size={compact ? 25 : 30} color={colors.primaryText} /></View>
          <Text style={styles.brand}>Sari-sari Store</Text>
          <Text style={[styles.title, compact && styles.titleCompact]}>Enter PIN</Text>
          <Text style={styles.subtitle}>Enter your 4-digit Owner PIN</Text>
          <View accessibilityLabel={`${pin.length} of ${OWNER_PIN_LENGTH} PIN digits entered`} style={[styles.dots, compact && styles.dotsCompact]}>
            {Array.from({ length: OWNER_PIN_LENGTH }, (_, index) => <View key={index} style={[styles.dot, index < pin.length && styles.dotFilled]} />)}
          </View>
          <View accessibilityLiveRegion="polite" style={[styles.message, compact && styles.messageCompact]}>
            {loading ? <><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.checking}>Checking PIN…</Text></> : error ? <><Ionicons name="alert-circle" size={18} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></> : null}
          </View>
        </View>
        <View style={[styles.pad, compact && styles.padCompact]}>
          {keyRows.map((row, rowIndex) => <View key={rowIndex} style={styles.keyRow}>{row.map((key, keyIndex) => key ? <Pressable key={key} accessibilityLabel={key === 'backspace' ? 'Delete last digit' : `Digit ${key}`} accessibilityRole="button" disabled={loading} onPress={() => pressKey(key)} style={({ pressed }) => [styles.key, { width: keySize, height: keySize, borderRadius: keySize / 2 }, pressed && styles.keyPressed, loading && styles.keyDisabled]}>{key === 'backspace' ? <Ionicons name="backspace-outline" size={28} color={colors.textPrimary} /> : <Text style={styles.keyText}>{key}</Text>}</Pressable> : <View key={`blank-${keyIndex}`} style={{ width: keySize, height: keySize }} />)}</View>)}
        </View>
        <Text style={styles.footer}>Owner access</Text>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  screenCompact: { paddingVertical: spacing.xs },
  header: { alignItems: 'center' },
  logo: { width: 60, height: 60, borderRadius: radius.xl, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, ...shadow },
  logoCompact: { width: 48, height: 48, borderRadius: radius.lg, marginBottom: spacing.sm },
  brand: { color: colors.textPrimary, fontSize: typography.title, fontWeight: typography.bold },
  title: { color: colors.textPrimary, fontSize: typography.display, fontWeight: typography.bold, marginTop: spacing.md },
  titleCompact: { fontSize: typography.title, marginTop: spacing.sm },
  subtitle: { color: colors.textSecondary, fontSize: typography.body, marginTop: spacing.xs },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.lg },
  dotsCompact: { marginTop: spacing.sm },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.primaryBorder, backgroundColor: colors.surface },
  dotFilled: { borderColor: colors.primary, backgroundColor: colors.primary },
  message: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  messageCompact: { marginTop: spacing.xs },
  checking: { color: colors.primary, fontSize: typography.bodySmall, fontWeight: typography.medium },
  errorText: { color: colors.danger, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  pad: { width: '100%', maxWidth: 200, gap: spacing.md, marginTop: spacing.sm },
  padCompact: { gap: spacing.sm },
  keyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  key: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow },
  keyPressed: { backgroundColor: colors.primarySoft, borderColor: colors.primaryBorder, transform: [{ scale: 0.96 }] },
  keyDisabled: { opacity: 0.6 },
  keyText: { color: colors.textPrimary, fontSize: 25, fontWeight: typography.medium },
  footer: { color: colors.textSecondary, fontSize: typography.bodySmall, marginTop: spacing.md },
}));
