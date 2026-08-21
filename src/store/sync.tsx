import * as Network from 'expo-network';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getSyncQueueCounts, retryFailedQueue } from '@/database/repositories/syncQueue';
import { ensureDeviceId, getLocalSetting } from '@/database/repositories/settings';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { synchronize } from '@/services/supabase/sync';
import { subscribeToSyncRequests } from '@/services/supabase/trigger';
import { SyncDiagnostics, SyncResult, SyncStatus } from '@/services/supabase/types';
import { useAppStore } from '@/store/app';

type SyncContextValue = SyncDiagnostics & { syncNow: () => Promise<SyncResult>; retryFailed: () => Promise<SyncResult>; refreshDiagnostics: () => Promise<void> };
const initial: SyncDiagnostics = { status: isSupabaseConfigured ? 'pending' : 'unconfigured', configured: isSupabaseConfigured, online: true, deviceId: '', lastSuccessfulSync: null, pendingCount: 0, failedCount: 0, message: isSupabaseConfigured ? 'Checking cloud sync…' : 'Cloud sync is not configured.' };
const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: PropsWithChildren) {
  const { refreshAll } = useAppStore();
  const [diagnostics, setDiagnostics] = useState<SyncDiagnostics>(initial);
  const refreshDiagnostics = useCallback(async () => {
    const [deviceId, lastSuccessfulSync, counts, network] = await Promise.all([ensureDeviceId(), getLocalSetting('sync_last_success_at'), getSyncQueueCounts(), Network.getNetworkStateAsync()]);
    const online = network.isConnected !== false && network.isInternetReachable !== false;
    setDiagnostics((current) => {
      let status: SyncStatus = current.status; let message = current.message;
      if (!isSupabaseConfigured) { status = 'unconfigured'; message = 'Add Supabase environment variables to enable cloud sync.'; }
      else if (!online) { status = 'offline'; message = 'Offline. Local changes are safe and will sync later.'; }
      else if (status !== 'syncing' && status !== 'error') { status = counts.pending ? 'pending' : 'synced'; message = counts.pending ? 'Local changes are waiting to upload.' : 'Local and cloud data are up to date.'; }
      return { ...current, configured: isSupabaseConfigured, online, deviceId, lastSuccessfulSync, pendingCount: counts.pending, failedCount: counts.failed, status, message };
    });
  }, []);
  const run = useCallback(async (includeFailed = false) => {
    setDiagnostics((current) => ({ ...current, status: 'syncing', message: 'Syncing local and cloud data…' }));
    const result = await synchronize(includeFailed);
    if (result.pulled) await refreshAll();
    const [counts, lastSuccessfulSync, network] = await Promise.all([getSyncQueueCounts(), getLocalSetting('sync_last_success_at'), Network.getNetworkStateAsync()]);
    const online = network.isConnected !== false && network.isInternetReachable !== false;
    setDiagnostics((current) => ({ ...current, status: result.status, online, lastSuccessfulSync, pendingCount: counts.pending, failedCount: counts.failed, message: result.message }));
    return result;
  }, [refreshAll]);
  const syncNow = useCallback(() => run(false), [run]);
  const retryFailed = useCallback(async () => { await retryFailedQueue(); return run(true); }, [run]);
  useEffect(() => {
    // Startup diagnostics synchronize React state with SQLite and the device network service.
    void refreshDiagnostics().then(() => { if (isSupabaseConfigured) void run(true); });
    const unsubscribeRequests = subscribeToSyncRequests(() => { if (isSupabaseConfigured) void run(false); else void refreshDiagnostics(); });
    let wasOnline: boolean | null = null;
    const subscription = Network.addNetworkStateListener((state) => {
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      setDiagnostics((current) => ({ ...current, online, status: online ? current.status : 'offline', message: online ? current.message : 'Offline. Local changes are safe and will sync later.' }));
      if (online && wasOnline === false && isSupabaseConfigured) void run(true);
      wasOnline = online;
    });
    return () => { unsubscribeRequests(); subscription.remove(); };
  }, [refreshDiagnostics, run]);
  const value = useMemo(() => ({ ...diagnostics, syncNow, retryFailed, refreshDiagnostics }), [diagnostics, syncNow, retryFailed, refreshDiagnostics]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() { const context = useContext(SyncContext); if (!context) throw new Error('useSync must be used within SyncProvider'); return context; }
