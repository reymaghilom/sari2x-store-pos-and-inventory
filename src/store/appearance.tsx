import { ThemeColors, themeHex } from '@/constants/theme';
import { AppearancePreference, getAppearancePreference, saveAppearancePreference } from '@/services/appSettings';
import * as SystemUI from 'expo-system-ui';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Appearance, StyleSheet, useColorScheme, View } from 'react-native';

type AppearanceContextValue = {
  preference: AppearancePreference;
  colorScheme: 'light' | 'dark';
  colors: ThemeColors;
  setPreference: (value: AppearancePreference) => Promise<void>;
};
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function applyPreference(value: AppearancePreference) {
  Appearance.setColorScheme(value === 'system' ? null : value);
}

export function AppearanceProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>('system');
  const [ready, setReady] = useState(false);
  const colorScheme = preference === 'system' ? systemScheme ?? 'light' : preference;
  const colors = themeHex[colorScheme];

  useEffect(() => {
    void getAppearancePreference().then((stored) => { setPreferenceState(stored); applyPreference(stored); }).catch(() => applyPreference('system')).finally(() => setReady(true));
  }, []);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  const value = useMemo<AppearanceContextValue>(() => ({
    preference,
    colorScheme,
    colors,
    setPreference: async (next) => { await saveAppearancePreference(next); setPreferenceState(next); applyPreference(next); },
  }), [colorScheme, colors, preference]);

  if (!ready) return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error('useAppearance must be used within AppearanceProvider');
  return context;
}

export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(factory: (colors: ThemeColors) => T) {
  return function useThemedStyles() {
    const { colors } = useAppearance();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
