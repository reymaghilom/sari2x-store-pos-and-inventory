import { createClient } from '@supabase/supabase-js';

import { createResetSnapshot, getBearerToken, OwnerResolutionError, performOwnerReplacement, resolveCanonicalOwner, Row, Snapshot, StoreAdminValidationError, tables, validateActionRequest } from './logic.ts';

const responseHeaders = { 'content-type': 'application/json' };
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: responseHeaders });
type AdminClient = ReturnType<typeof createClient<any>>;

async function countsForOwner(service: AdminClient, ownerId: string) {
  const entries = await Promise.all(tables.map(async (table) => {
    const { count, error } = await service.from(table).select('*', { count: 'exact', head: true }).eq('owner_id', ownerId);
    if (error) throw error;
    return [table, count ?? 0] as const;
  }));
  return Object.fromEntries(entries) as Record<typeof tables[number], number>;
}

async function unownedCount(service: AdminClient) {
  const values = await Promise.all(tables.map(async (table) => {
    const { count, error } = await service.from(table).select('*', { count: 'exact', head: true }).is('owner_id', null);
    if (error) throw error;
    return count ?? 0;
  }));
  return values.reduce((sum, count) => sum + count, 0);
}

async function verifySnapshot(service: AdminClient, ownerId: string, snapshot: Snapshot) {
  const counts = await countsForOwner(service, ownerId);
  for (const table of tables) {
    const expectedIds = snapshot.tables[table].map((row) => String(table === 'settings' ? row.key : row.id));
    if (counts[table] !== expectedIds.length) throw new Error(`Cloud row-count verification failed for ${table}.`);
    for (let offset = 0; offset < expectedIds.length; offset += 500) {
      const batch = expectedIds.slice(offset, offset + 500);
      const key = table === 'settings' ? 'key' : 'id';
      const { data, error } = await service.from(table).select(key).eq('owner_id', ownerId).in(key, batch);
      if (error || data?.length !== batch.length) throw new Error(`Cloud identifier verification failed for ${table}.`);
    }
  }
  return counts;
}

async function enrolledOwner(service: AdminClient, ownerId: string) {
  const { data, error } = await service.from('store_owners').select('owner_id').eq('owner_id', ownerId).maybeSingle();
  if (error || data?.owner_id !== ownerId) throw new Error('Authenticated Owner enrollment could not be verified.');
}

async function resetOwnerSnapshot(service: AdminClient, ownerId: string) {
  const columns = 'id,name,username,role,status,created_at,updated_at,deleted_at,origin_device_id,owner_id';
  const { data, error, count } = await service.from('users').select(columns, { count: 'exact' }).eq('owner_id', ownerId).order('created_at', { ascending: true }).limit(1000);
  if (error) throw error;
  if ((count ?? 0) !== (data?.length ?? 0)) throw new Error('Owner metadata exceeds the safe reset diagnostic limit.');
  return createResetSnapshot(resolveCanonicalOwner((data ?? []) as Row[], ownerId).owner);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { ok: false, message: 'Method not allowed.' });
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 5 * 1024 * 1024) return json(413, { ok: false, message: 'Cloud snapshot is too large.' });
  let action = 'unknown';
  let stage = 'configuration';
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const allowedEmail = Deno.env.get('STORE_OWNER_EMAIL')?.trim().toLowerCase();
    if (!url || !anonKey || !serviceKey || !allowedEmail) return json(500, { ok: false, message: 'Store administration is not configured.' });

    stage = 'authorization';
    const token = getBearerToken(request.headers.get('authorization'));
    const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await authClient.auth.getUser(token);
    if (authError || !auth.user) return json(401, { ok: false, message: 'Cloud backup session is invalid or expired.' });
    if (auth.user.email?.trim().toLowerCase() !== allowedEmail) return json(403, { ok: false, message: 'This account is not authorized to administer this store.' });

    stage = 'request-parsing';
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > 5 * 1024 * 1024) return json(413, { ok: false, message: 'Cloud snapshot is too large.' });
    const raw = JSON.parse(rawBody) as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && typeof (raw as { action?: unknown }).action === 'string') action = (raw as { action: string }).action;
    const body = validateActionRequest(raw);
    action = body.action;

    stage = 'owner-enrollment';
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const ownerId = auth.user.id;
    const { error: registrationError } = await service.from('store_owners').upsert({ owner_id: ownerId }, { onConflict: 'owner_id' });
    if (registrationError) throw registrationError;
    await enrolledOwner(service, ownerId);
    const unownedRows = await unownedCount(service);

    if (body.action === 'status') {
      const ownedCounts = await countsForOwner(service, ownerId);
      return json(200, { ok: true, message: 'Cloud Backup account connected.', status: { ownerId, email: auth.user.email ?? null, claimRequired: unownedRows > 0, unownedRows, ownedCounts } });
    }
    if (body.action === 'claim') {
      stage = 'claim';
      const { error } = await service.rpc('admin_claim_unowned_store', { p_owner_id: ownerId });
      if (error) throw error;
      const remaining = await unownedCount(service);
      if (remaining !== 0) throw new Error('Existing cloud ownership verification failed.');
      return json(200, { ok: true, message: 'Existing store backup claimed successfully.', counts: await countsForOwner(service, ownerId) });
    }
    if (unownedRows > 0) return json(409, { ok: false, message: 'Claim the existing store backup before continuing.' });

    stage = body.action === 'reset' ? 'reset-preparation' : 'snapshot-validation';
    // Reset never reads or validates a client snapshot. The server preserves the
    // one cloud Owner profile and creates reset defaults itself.
    const snapshot = body.action === 'reset' ? await resetOwnerSnapshot(service, ownerId) : body.snapshot;
    stage = body.action === 'reset' ? 'reset-rpc' : 'replace-rpc';
    const counts = await performOwnerReplacement(
      ownerId,
      snapshot,
      async (verifiedOwnerId, trustedSnapshot) => {
        const { error } = await service.rpc('admin_replace_owned_store', { p_owner_id: verifiedOwnerId, p_snapshot: trustedSnapshot });
        if (error) throw error;
      },
      async (verifiedOwnerId, trustedSnapshot) => {
        stage = body.action === 'reset' ? 'reset-verification' : 'replace-verification';
        return verifySnapshot(service, verifiedOwnerId, trustedSnapshot);
      },
    );
    if (await unownedCount(service) !== 0) throw new Error('Cloud ownership verification failed after replacement.');
    return json(200, { ok: true, message: body.action === 'reset' ? 'Cloud store data cleared and verified.' : 'Cloud backup updated successfully.', counts });
  } catch (error) {
    const validation = error instanceof StoreAdminValidationError ? error : null;
    const ownerResolution = error instanceof OwnerResolutionError ? error : null;
    console.error('store-admin failure', {
      action,
      stage: validation?.stage ?? ownerResolution?.stage ?? stage,
      table: validation?.table ?? null,
      fields: validation?.fields ?? [],
      ownerCandidateCount: ownerResolution?.candidateCount ?? null,
      ownerCandidates: ownerResolution?.candidates ?? [],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return json(validation?.status ?? 400, { ok: false, message: validation?.publicMessage ?? ownerResolution?.publicMessage ?? 'Store administration failed safely.' });
  }
});
