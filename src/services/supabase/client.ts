import 'react-native-url-polyfill/auto';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publicKey = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)?.trim();

export const isSupabaseConfigured = Boolean(url && publicKey);

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!isSupabaseConfigured || !url || !publicKey) return null;
  if (!client) {
    client = createClient(url, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async (input, init) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15_000);
          try { return await fetch(input, { ...init, signal: controller.signal }); }
          finally { clearTimeout(timeout); }
        },
      },
    });
  }
  return client;
}
