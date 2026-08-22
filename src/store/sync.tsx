import * as Network from 'expo-network';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getSyncQueueCounts, retryFailedQueue } from '@/database/repositories/syncQueue';
import { ensureDeviceId, getLocalSetting } from '@/database/repositories/settings';
import { getSupabaseClient, isSupabaseConfigured } from '@/services/supabase/client';
import { synchronize } from '@/services/supabase/sync';
import { subscribeToSyncRequests } from '@/services/supabase/trigger';
import { SyncDiagnostics, SyncResult, SyncStatus } from '@/services/supabase/types';
import { useAppStore } from '@/store/app';

type SyncContextValue = SyncDiagnostics & { syncNow: () => Promise<SyncResult>; retryFailed: () => Promise<SyncResult>; refreshDiagnostics: () => Promise<void> };
const initial: SyncDiagnostics = { status: isSupabaseConfigured ? 'pending' : 'unconfigured', configured: isSupabaseConfigured, online: true, deviceId: '', lastSuccessfulSync: null, pendingCount: 0, failedCount: 0, restoreNeedsCloudReconciliation: false, message: isSupabaseConfigured ? 'Checking cloud backup…' : 'Cloud backup is not configured.' };
const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: PropsWithChildren) {
  const { refreshAll } = useAppStore();
  const [diagnostics, setDiagnostics] = useState<SyncDiagnostics>(initial);
  const refreshDiagnostics = useCallback(async () => {
    const client = getSupabaseClient();
    const [deviceId, lastSuccessfulSync, restorePending, counts, network, auth] = await Promise.all([ensureDeviceId(), getLocalSetting('sync_last_success_at'), getLocalSetting('sync_restore_pending'), getSyncQueueCounts(), Network.getNetworkStateAsync(), client?.auth.getSession()]);
    const online = network.isConnected !== false && network.isInternetReachable !== false;
    setDiagnostics((current) => {
      let status: SyncStatus = current.status; let message = current.message;
      if (restorePending === '1') { status = 'error'; message = 'Your backup was restored on this phone. Update your cloud backup before automatic sync resumes.'; }
      else if (!isSupabaseConfigured) { status = 'unconfigured'; message = 'Cloud backup is not configured.'; }
      else if (!online) { status = 'offline'; message = "You're offline. Changes are saved on this phone and will sync when internet is available."; }
      else if (!auth?.data.session) { status = 'error'; message = 'Cloud backup needs sign-in.'; }
      else if (status !== 'syncing') {
        if (counts.failed) { status = 'error'; message = 'Some changes could not be backed up. Try again.'; }
        else { status = counts.pending ? 'pending' : 'synced'; message = counts.pending ? 'Some changes are waiting to be backed up.' : 'Cloud backup is up to date.'; }
      }
      return { ...current, configured: isSupabaseConfigured, online, deviceId, lastSuccessfulSync, pendingCount: counts.pending, failedCount: counts.failed, restoreNeedsCloudReconciliation: restorePending === '1', status, message };
    });
  }, []);
  const run = useCallback(async (includeFailed = false) => {
    setDiagnostics((current) => ({ ...current, status: 'syncing', message: 'Syncing local and cloud data…' }));
    const result = await synchronize(includeFailed);
    if (result.pulled) await refreshAll();
    const [counts, lastSuccessfulSync, restorePending, network] = await Promise.all([getSyncQueueCounts(), getLocalSetting('sync_last_success_at'), getLocalSetting('sync_restore_pending'), Network.getNetworkStateAsync()]);
    const online = network.isConnected !== false && network.isInternetReachable !== false;
    setDiagnostics((current) => ({ ...current, status: result.status, online, lastSuccessfulSync, pendingCount: counts.pending, failedCount: counts.failed, restoreNeedsCloudReconciliation: restorePending === '1', message: result.message }));
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
      setDiagnostics((current) => ({ ...current, online, status: online ? current.status : 'offline', message: online ? current.message : "You're offline. Changes are saved on this phone and will sync when internet is available." }));
      if (online && wasOnline === false && isSupabaseConfigured) void run(true);
      wasOnline = online;
    });
    const client = getSupabaseClient();
    const authSubscription = client?.auth.onAuthStateChange((event, session) => {
      setTimeout(() => { void refreshDiagnostics().then(() => { if (session && event === 'SIGNED_IN') void run(true); }); }, 0);
    });
    return () => { unsubscribeRequests(); subscription.remove(); authSubscription?.data.subscription.unsubscribe(); };
  }, [refreshDiagnostics, run]);
  const value = useMemo(() => ({ ...diagnostics, syncNow, retryFailed, refreshDiagnostics }), [diagnostics, syncNow, retryFailed, refreshDiagnostics]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() { const context = useContext(SyncContext); if (!context) throw new Error('useSync must be used within SyncProvider'); return context; }
