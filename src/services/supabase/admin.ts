import { completeRestoreCloudReconciliation, createLocalCloudSnapshot, syncEntityTypes } from '@/database/repositories/sync';
import { ensureDeviceId, getLocalSetting } from '@/database/repositories/settings';
import { getSupabaseClient } from '@/services/supabase/client';

const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;

export type StoreAdminStatus = {
  ownerId: string;
  email: string | null;
  claimRequired: boolean;
  unownedRows: number;
  ownedCounts: Record<string, number>;
};

type StoreAdminResponse = { ok: boolean; message: string; status?: StoreAdminStatus; counts?: Record<string, number> };

async function invokeStoreAdmin(body: Record<string, unknown>): Promise<StoreAdminResponse> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Cloud backup is not configured.');
  const { data: auth, error: authError } = await client.auth.getSession();
  if (authError || !auth.session) throw new Error('Cloud backup needs sign-in.');
  const { data, error } = await client.functions.invoke<StoreAdminResponse>('store-admin', { body });
  if (error) {
    let message = error.message;
    if ('context' in error && error.context instanceof Response) {
      try { const details = await error.context.clone().json() as { message?: string }; message = details.message ?? message; } catch { /* Use the SDK error. */ }
    }
    throw new Error(message);
  }
  if (!data?.ok) throw new Error(data?.message || 'Cloud administration could not be completed.');
  return data;
}

export async function getStoreAdminStatus() {
  const result = await invokeStoreAdmin({ action: 'status' });
  if (!result.status) throw new Error('Cloud Backup account status was unavailable.');
  return result.status;
}

export async function claimExistingCloudBackup() {
  return invokeStoreAdmin({ action: 'claim' });
}

export async function resetAuthenticatedCloudStore() {
  const result = await invokeStoreAdmin({ action: 'reset' });
  for (const table of syncEntityTypes) {
    const expected = table === 'users' ? 1 : table === 'settings' ? 5 : 0;
    if (result.counts?.[table] !== expected) throw new Error(`Cloud reset verification failed for ${table}. Local data was not changed.`);
  }
  return result;
}

export async function replaceAuthenticatedCloudBackup() {
  if (await getLocalSetting('sync_restore_pending') !== '1') throw new Error('There is no restored backup waiting to update the cloud.');
  const snapshot = await createLocalCloudSnapshot(await ensureDeviceId());
  const payload = JSON.stringify({ action: 'replace', snapshot });
  if (new TextEncoder().encode(payload).length > MAX_SNAPSHOT_BYTES) throw new Error('This backup is too large for one cloud update. Contact support before retrying.');
  const result = await invokeStoreAdmin(JSON.parse(payload) as Record<string, unknown>);
  const expected = Object.fromEntries(syncEntityTypes.map((table) => [table, snapshot.tables[table].length]));
  for (const table of syncEntityTypes) if (result.counts?.[table] !== expected[table]) throw new Error(`Cloud verification failed for ${table}. Automatic sync remains paused.`);
  await completeRestoreCloudReconciliation();
  return result;
}
