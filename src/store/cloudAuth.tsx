import { Session } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getSupabaseClient, isSupabaseConfigured } from '@/services/supabase/client';

type CloudAuthResult = { ok: boolean; message: string; needsEmailConfirmation?: boolean };
type CloudAuthContextValue = {
  configured: boolean;
  initialized: boolean;
  session: Session | null;
  email: string | null;
  signUp: (email: string, password: string) => Promise<CloudAuthResult>;
  signIn: (email: string, password: string) => Promise<CloudAuthResult>;
  signOut: () => Promise<CloudAuthResult>;
  refreshSession: () => Promise<void>;
};

const CloudAuthContext = createContext<CloudAuthContextValue | null>(null);

export function CloudAuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(!isSupabaseConfigured);
  const client = getSupabaseClient();

  const refreshSession = useCallback(async () => {
    if (!client) { setSession(null); setInitialized(true); return; }
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    setSession(data.session);
    setInitialized(true);
  }, [client]);

  useEffect(() => {
    void refreshSession().catch(() => setInitialized(true));
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setInitialized(true); });
    return () => data.subscription.unsubscribe();
  }, [client, refreshSession]);

  const signUp = useCallback(async (email: string, password: string): Promise<CloudAuthResult> => {
    if (!client) return { ok: false, message: 'Cloud backup is not configured.' };
    const { data, error } = await client.auth.signUp({ email: email.trim(), password });
    if (error) return { ok: false, message: error.message };
    setSession(data.session);
    return data.session
      ? { ok: true, message: 'Cloud Backup account connected.' }
      : { ok: true, needsEmailConfirmation: true, message: 'Check your email to confirm the account, then sign in.' };
  }, [client]);

  const signIn = useCallback(async (email: string, password: string): Promise<CloudAuthResult> => {
    if (!client) return { ok: false, message: 'Cloud backup is not configured.' };
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, message: error.message };
    setSession(data.session);
    return { ok: true, message: 'Cloud Backup account connected.' };
  }, [client]);

  const signOut = useCallback(async (): Promise<CloudAuthResult> => {
    if (!client) return { ok: true, message: 'Cloud Backup account signed out.' };
    const { error } = await client.auth.signOut();
    if (error) return { ok: false, message: error.message };
    setSession(null);
    return { ok: true, message: 'Cloud Backup account signed out. Your local app remains available.' };
  }, [client]);

  const value = useMemo<CloudAuthContextValue>(() => ({ configured: isSupabaseConfigured, initialized, session, email: session?.user.email ?? null, signUp, signIn, signOut, refreshSession }), [initialized, session, signUp, signIn, signOut, refreshSession]);
  return <CloudAuthContext.Provider value={value}>{children}</CloudAuthContext.Provider>;
}

export function useCloudAuth() {
  const context = useContext(CloudAuthContext);
  if (!context) throw new Error('useCloudAuth must be used within CloudAuthProvider');
  return context;
}
