import * as Network from 'expo-network';

import { applyRemoteRecords, clearDevelopmentSeedData, getLocalCloudRecord, getLocalEntityIds, recomputeCachedStock, RemoteRecord, SyncEntityType, syncEntityTypes } from '@/database/repositories/sync';
import { getQueuedChangesForEntity, getSyncQueueCounts, markQueueFailed, markQueueSynced } from '@/database/repositories/syncQueue';
import { ensureDeviceId, getLocalSetting, setLocalSetting } from '@/database/repositories/settings';
import { getSupabaseClient, isSupabaseConfigured } from '@/services/supabase/client';
import { SyncResult } from '@/services/supabase/types';

const immutableEntities = new Set<SyncEntityType>(['stock_movements', 'sale_items', 'sale_voids', 'sale_refunds', 'sale_refund_items', 'credit_payments']);
const pullOrder: SyncEntityType[] = ['users', 'categories', 'customers', 'products', 'sales', 'sale_items', 'sale_voids', 'sale_refunds', 'sale_refund_items', 'stock_movements', 'credit_transactions', 'credit_payments', 'settings'];
let activeSync: Promise<SyncResult> | null = null;

function friendlyFailure(error: unknown) {
  if (__DEV__) console.warn('Cloud sync diagnostic:', error);
  if (error instanceof Error && error.name === 'AbortError') return 'Cloud backup timed out. Your data is safe on this phone.';
  return 'Some changes could not be backed up. Try again.';
}

async function onlineNow() {
  const state = await Network.getNetworkStateAsync();
  return state.isConnected !== false && state.isInternetReachable !== false;
}

async function authenticatedOwnerId() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session?.user.id ?? null;
}

async function cloudHasBusinessData(ownerId: string) {
  const client = getSupabaseClient();
  if (!client) return false;
  const checks = await Promise.all(syncEntityTypes.map((table) => client.from(table).select(table === 'settings' ? 'key' : 'id').eq('owner_id', ownerId).limit(1)));
  for (const check of checks) if (check.error) throw check.error;
  return checks.some((check) => Boolean(check.data?.length));
}

async function ensureCloudUserProfiles(deviceId: string, ownerId: string) {
  const client = getSupabaseClient(); if (!client) return;
  const { data, error } = await client.from('users').select('id').eq('owner_id', ownerId).limit(1);
  if (error) throw error;
  if (data?.length) return;
  const ids = await getLocalEntityIds('users');
  const rows = (await Promise.all(ids.map((id) => getLocalCloudRecord('users', id, deviceId)))).filter((row): row is RemoteRecord => Boolean(row)).map((row) => ({ ...row, owner_id: ownerId }));
  if (rows.length) { const result = await client.from('users').upsert(rows, { onConflict: 'id' }); if (result.error) throw result.error; }
}

async function pushPending(includeFailed: boolean, deviceId: string, ownerId: string) {
  const client = getSupabaseClient();
  if (!client) return { pushed: 0, failed: 0 };
  let pushed = 0; let failed = 0;
  for (const entityType of syncEntityTypes) {
    const attempted = new Set<string>();
    while (true) {
      const items = (await getQueuedChangesForEntity(entityType, includeFailed, attempted.size + 500)).filter((item) => !attempted.has(item.id)).slice(0, 500);
      if (!items.length) break;
      items.forEach((item) => attempted.add(item.id));
      const byEntity = new Map<string, typeof items>();
      for (const item of items) byEntity.set(item.entity_id, [...(byEntity.get(item.entity_id) ?? []), item]);
      const rows: RemoteRecord[] = [];
      const queueIds: string[] = [];
      for (const [entityId, entityItems] of byEntity) {
        const row = await getLocalCloudRecord(entityType, entityId, deviceId);
        if (row) rows.push({ ...row, owner_id: ownerId });
        else if (entityItems.some((item) => item.operation === 'delete')) {
          const updatedAt = new Date().toISOString();
          rows.push(entityType === 'settings' ? { key: entityId, value: '', updated_at: updatedAt, deleted_at: updatedAt, origin_device_id: deviceId, owner_id: ownerId } : { id: entityId, updated_at: updatedAt, deleted_at: updatedAt, origin_device_id: deviceId, owner_id: ownerId });
        }
        queueIds.push(...entityItems.map((item) => item.id));
      }
      if (!rows.length) { await markQueueSynced(queueIds); continue; }
      const options = { onConflict: entityType === 'settings' ? 'key' : 'id', ignoreDuplicates: immutableEntities.has(entityType) };
      const { error } = await client.from(entityType).upsert(rows, options);
      if (error) { await markQueueFailed(queueIds); failed += queueIds.length; if (__DEV__) console.warn(`Push failed for ${entityType}:`, error); }
      else { await markQueueSynced(queueIds); pushed += queueIds.length; }
    }
  }
  return { pushed, failed };
}

async function pullChanges(since: string, ownerId: string) {
  const client = getSupabaseClient();
  if (!client) return 0;
  let pulled = 0;
  for (const entityType of pullOrder) {
    let offset = 0;
    while (true) {
      const { data, error } = await client.from(entityType).select('*').eq('owner_id', ownerId).gt('updated_at', since).order('updated_at', { ascending: true }).range(offset, offset + 499);
      if (error) throw error;
      const rows = (data ?? []) as RemoteRecord[];
      await applyRemoteRecords(entityType, rows);
      pulled += rows.length;
      if (rows.length < 500) break;
      offset += 500;
    }
  }
  await recomputeCachedStock();
  return pulled;
}

async function runSync(includeFailed: boolean): Promise<SyncResult> {
  if (!isSupabaseConfigured) return { ok: false, status: 'unconfigured', pushed: 0, pulled: 0, message: 'Cloud backup is not configured.' };
  if (!(await onlineNow())) return { ok: false, status: 'offline', pushed: 0, pulled: 0, message: "You're offline. Changes are saved on this phone and will sync when internet is available." };
  let ownerId: string | null = null;
  try { ownerId = await authenticatedOwnerId(); }
  catch (error) { return { ok: false, status: 'error', pushed: 0, pulled: 0, message: friendlyFailure(error) }; }
  if (!ownerId) return { ok: false, status: 'error', pushed: 0, pulled: 0, message: 'Cloud backup needs sign-in.' };
  if (await getLocalSetting('sync_restore_pending') === '1') return { ok: false, status: 'error', pushed: 0, pulled: 0, message: 'Your backup was restored on this phone. Update your cloud backup before automatic sync resumes.' };
  const syncStartedAt = new Date().toISOString();
  await setLocalSetting('sync_status', 'syncing');
  try {
    const deviceId = await ensureDeviceId();
    const lastPullAt = await getLocalSetting('sync_last_pull_at');
    const bootstrapComplete = await getLocalSetting('sync_bootstrap_complete');
    if (!bootstrapComplete && await cloudHasBusinessData(ownerId)) await clearDevelopmentSeedData();
    if (!bootstrapComplete) await ensureCloudUserProfiles(deviceId, ownerId);

    const push = await pushPending(includeFailed, deviceId, ownerId);
    const pulled = await pullChanges(lastPullAt ?? '1970-01-01T00:00:00.000Z', ownerId);
    await setLocalSetting('sync_last_pull_at', syncStartedAt);
    await setLocalSetting('sync_bootstrap_complete', '1');
    const remaining = await getSyncQueueCounts();
    if (push.failed || remaining.pending || remaining.failed) {
      await setLocalSetting('sync_status', 'error');
      return { ok: false, status: 'error', pushed: push.pushed, pulled, message: remaining.failed ? 'Some changes could not be backed up. Try again.' : 'Some changes are waiting to be backed up.' };
    }
    await setLocalSetting('sync_last_success_at', syncStartedAt);
    await setLocalSetting('sync_status', 'synced');
    return { ok: true, status: 'synced', pushed: push.pushed, pulled, message: 'Cloud backup is up to date.' };
  } catch (error) {
    await setLocalSetting('sync_status', 'error');
    return { ok: false, status: 'error', pushed: 0, pulled: 0, message: friendlyFailure(error) };
  }
}

export function synchronize(includeFailed = false) {
  if (activeSync) return activeSync;
  activeSync = runSync(includeFailed).finally(() => { activeSync = null; });
  return activeSync;
}
