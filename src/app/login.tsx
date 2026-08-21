import { PrimaryButton } from '@/components/ui';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/store/auth';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [hidden, setHidden] = useState(true); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { if (loading) return; setLoading(true); const success = await login(username, password); setLoading(false); if (success) { setError(''); router.replace('/(tabs)'); } else setError('Incorrect credentials or this account is disabled.'); };
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.hero}><View style={styles.logo}><Ionicons name="storefront" size={36} color={colors.white} /></View><Text style={styles.brand}>Sari-sari Store</Text><Text style={styles.tagline}>Inventory and POS made simple</Text></View>
    <View style={styles.panel}><Text style={styles.title}>Welcome back</Text><Text style={styles.subtitle}>Sign in to manage your store</Text>
      <Text style={styles.label}>Username</Text><View style={styles.inputWrap}><Ionicons name="person-outline" size={20} color={colors.textMuted} /><TextInput autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} placeholder="Enter username" placeholderTextColor={colors.textMuted} style={styles.input} /></View>
      <Text style={styles.label}>PIN / Password</Text><View style={styles.inputWrap}><Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} /><TextInput value={password} onChangeText={setPassword} placeholder="Enter PIN or password" placeholderTextColor={colors.textMuted} secureTextEntry={hidden} style={styles.input} onSubmitEditing={submit} /><Pressable accessibilityLabel={hidden ? 'Show password' : 'Hide password'} onPress={() => setHidden((value) => !value)}><Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={21} color={colors.textMuted} /></Pressable></View>
      {error ? <View style={styles.error}><Ionicons name="alert-circle" size={17} color={colors.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
      <PrimaryButton title="Login" icon="log-in-outline" onPress={() => void submit()} loading={loading} style={{ marginTop: spacing.md }} />
    </View><Text style={styles.footer}>Secure access for authorized store staff</Text>
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.primary }, keyboard: { flex: 1, justifyContent: 'center', padding: spacing.xl }, hero: { alignItems: 'center', marginBottom: spacing.xxl }, logo: { width: 76, height: 76, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }, brand: { color: colors.white, fontSize: typography.display, fontWeight: typography.bold }, tagline: { color: '#DCE6FF', fontSize: typography.body, marginTop: spacing.xs }, panel: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, ...shadow }, title: { fontSize: typography.title, fontWeight: typography.bold, color: colors.text }, subtitle: { fontSize: typography.body, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.xl }, label: { fontSize: typography.bodySmall, fontWeight: typography.semibold, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm }, inputWrap: { height: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.background }, input: { flex: 1, fontSize: typography.body, color: colors.text }, error: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.md }, errorText: { flex: 1, color: colors.danger, fontSize: typography.bodySmall }, footer: { color: '#DCE6FF', textAlign: 'center', marginTop: spacing.xl, fontSize: typography.bodySmall } });
