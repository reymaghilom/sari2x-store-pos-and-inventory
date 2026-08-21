import { AppUser } from '@/types';
import { authenticateUser } from '@/database/repositories/users';
import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

type AuthContextValue = { user: AppUser | null; login: (username: string, password: string) => Promise<boolean>; logout: () => void; isAdmin: boolean };
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const value = useMemo<AuthContextValue>(() => ({
    user,
    login: async (username, password) => {
      try { const match = await authenticateUser(username, password); if (!match) return false; setUser(match); return true; }
      catch (error) { console.error('Local login failed', error); return false; }
    },
    logout: () => setUser(null),
    isAdmin: user?.role === 'admin',
  }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
