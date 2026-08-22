import 'react-native-url-polyfill/auto';

import * as SecureStore from 'expo-secure-store';
import { createClient, processLock, SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publicKey = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)?.trim();

export const isSupabaseConfigured = Boolean(url && publicKey);

let client: SupabaseClient | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
const SECURE_CHUNK_SIZE = 1800;

const secureSessionStorage = {
  getItem: async (key: string) => {
    const countValue = await SecureStore.getItemAsync(`${key}.chunks`);
    const count = Number(countValue);
    if (!Number.isInteger(count) || count < 1) return null;
    const chunks = await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)));
    return chunks.every((chunk): chunk is string => chunk !== null) ? chunks.join('') : null;
  },
  setItem: async (key: string, value: string) => {
    await secureSessionStorage.removeItem(key);
    const chunks = Array.from({ length: Math.ceil(value.length / SECURE_CHUNK_SIZE) }, (_, index) => value.slice(index * SECURE_CHUNK_SIZE, (index + 1) * SECURE_CHUNK_SIZE));
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}.${index}`, chunk)));
    await SecureStore.setItemAsync(`${key}.chunks`, String(chunks.length));
  },
  removeItem: async (key: string) => {
    const count = Number(await SecureStore.getItemAsync(`${key}.chunks`));
    if (Number.isInteger(count) && count > 0) await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(`${key}.${index}`)));
    await SecureStore.deleteItemAsync(`${key}.chunks`);
  },
};

export function getSupabaseClient() {
  if (!isSupabaseConfigured || !url || !publicKey) return null;
  if (!client) {
    client = createClient(url, publicKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, lock: processLock, ...(Platform.OS === 'web' ? {} : { storage: secureSessionStorage }) },
      global: {
        fetch: async (input, init) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15_000);
          try { return await fetch(input, { ...init, signal: controller.signal }); }
          finally { clearTimeout(timeout); }
        },
      },
    });
    client.auth.startAutoRefresh();
    appStateSubscription ??= AppState.addEventListener('change', (state) => {
      if (!client) return;
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
  }
  return client;
}
