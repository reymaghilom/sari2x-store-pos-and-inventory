import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

async function enterImmersiveMode() {
  if (Platform.OS !== 'android') return;
  try {
    await NavigationBar.setBehaviorAsync('overlay-swipe');
  } catch (error) {
    if (__DEV__) console.warn('Android navigation-bar behavior is unavailable on this device.', error);
  }
  try {
    await NavigationBar.setVisibilityAsync('hidden');
  } catch (error) {
    if (__DEV__) console.warn('Android navigation-bar visibility could not be changed.', error);
  }
}

export function useAndroidImmersiveNavigation() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void enterImmersiveMode();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void enterImmersiveMode();
    });
    return () => subscription.remove();
  }, []);
}
