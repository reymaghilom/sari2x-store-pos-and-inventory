import { AppUser } from '@/types';
import { authenticateOwnerPin } from '@/database/repositories/users';
import { getLocalSetting } from '@/database/repositories/settings';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

type AuthContextValue = { user: AppUser | null; unlock: (pin: string) => Promise<boolean>; lock: () => void; isOwner: boolean; isAdmin: boolean };
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'inactive' || state === 'background') {
        backgroundedAt.current ??= Date.now();
        return;
      }
      if (state === 'active' && backgroundedAt.current !== null) {
        const elapsed = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        void getLocalSetting('security_lock_timeout_ms').then((stored) => {
          const timeout = stored === null ? 300_000 : Number(stored);
          if (Number.isFinite(timeout) && timeout >= 0 && elapsed >= timeout) setUser(null);
        }).catch((error) => console.error('Could not read app-lock timeout', error));
      }
    });
    return () => subscription.remove();
  }, []);
  const value = useMemo<AuthContextValue>(() => ({
    user,
    unlock: async (pin) => {
      try { const match = await authenticateOwnerPin(pin); if (!match) return false; setUser(match); return true; }
      catch (error) { console.error('Local PIN unlock failed', error); return false; }
    },
    lock: () => setUser(null),
    isOwner: Boolean(user),
    isAdmin: Boolean(user),
  }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
