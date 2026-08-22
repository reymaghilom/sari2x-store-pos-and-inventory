import {
  createResetSnapshot,
  getBearerToken,
  OwnerResolutionError,
  performOwnerReplacement,
  resolveCanonicalOwner,
  Snapshot,
  StoreAdminValidationError,
  tables,
  validateActionRequest,
  validateSnapshot,
} from '../store-admin/logic';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function emptySnapshot(): Snapshot {
  const snapshot = { snapshot_format: 'sari-sari-store-cloud-snapshot', snapshot_version: 1, tables: {} } as Snapshot;
  for (const table of tables) snapshot.tables[table] = [];
  return snapshot;
}

async function run() {
  let snapshotValidationCalls = 0;
  const reset = validateActionRequest({ action: 'reset' }, (value) => { snapshotValidationCalls += 1; return validateSnapshot(value); });
  assert(reset.action === 'reset', 'Reset request was not routed as reset.');
  assert(snapshotValidationCalls === 0, 'Reset unexpectedly called validateSnapshot.');

  const valid = emptySnapshot();
  valid.tables.settings = [{ key: 'store_address', value: '', updated_at: '2026-08-22T12:00:00.000Z', deleted_at: null, origin_device_id: 'device-fixture' }];
  const replace = validateActionRequest({ action: 'replace', snapshot: valid });
  assert(replace.action === 'replace' && replace.snapshot.tables.settings[0].value === '', 'Valid replacement settings were rejected.');

  const incomplete = emptySnapshot();
  incomplete.tables.settings = [{ key: 'store_address', value: '' }];
  try {
    validateActionRequest({ action: 'replace', snapshot: incomplete });
    throw new Error('Incomplete settings fixture was accepted.');
  } catch (error) {
    assert(error instanceof StoreAdminValidationError, 'Incomplete settings did not return a structured validation error.');
    assert(error.table === 'settings' && error.fields.includes('updated_at'), 'Incomplete settings error omitted the exact missing field.');
  }

  try {
    getBearerToken(null);
    throw new Error('Unauthorized reset fixture was accepted.');
  } catch (error) {
    assert(error instanceof StoreAdminValidationError && error.status === 401, 'Unauthorized request was not rejected with 401.');
  }

  const owner = { id: '11111111-1111-4111-8111-111111111111', name: 'Owner', username: 'owner', role: 'admin', status: 'active', created_at: '2026-08-22T12:00:00.000Z', updated_at: '2026-08-22T12:00:00.000Z', deleted_at: null, origin_device_id: 'device-fixture', owner_id: 'store-a' };
  const single = resolveCanonicalOwner([owner], 'store-a');
  assert(single.owner.id === owner.id && !('owner_id' in single.owner), 'Exactly one canonical Owner was not selected safely.');

  const historical = [
    { ...owner, id: 'seed-admin', name: 'Admin', username: 'admin' },
    { ...owner, id: 'seed-tindera-1', name: 'Tindera 1', username: 'tindera1', role: 'staff' },
    owner,
  ];
  const selected = resolveCanonicalOwner(historical, 'store-a');
  assert(selected.owner.id === owner.id, 'Historical Admin/Tindera metadata displaced the canonical Owner.');
  assert(selected.diagnostics.find((candidate) => candidate.id === 'seed-admin')?.reasons.includes('legacy_or_invalid_identifier'), 'Legacy Admin disqualification was not diagnosed.');

  for (const fixture of [
    { rows: [], ownerId: 'store-a', expected: 0 },
    { rows: [owner, { ...owner, id: '22222222-2222-4222-8222-222222222222' }], ownerId: 'store-a', expected: 2 },
    { rows: [owner], ownerId: 'store-b', expected: 0 },
  ]) {
    try {
      resolveCanonicalOwner(fixture.rows, fixture.ownerId);
      throw new Error('Invalid canonical Owner fixture was accepted.');
    } catch (error) {
      assert(error instanceof OwnerResolutionError && error.candidateCount === fixture.expected, 'Canonical Owner failure did not report the expected safe candidate count.');
    }
  }

  const resetSnapshot = createResetSnapshot(owner, '2026-08-22T12:00:00.000Z');
  assert(!('owner_id' in resetSnapshot.tables.users[0]), 'Trusted reset snapshot leaked client ownership into the RPC payload.');
  const state = new Map([['owner-a', 12], ['owner-b', 8]]);
  await performOwnerReplacement('owner-a', resetSnapshot, async (ownerId, snapshot) => {
    assert(ownerId === 'owner-a', 'Replacement did not use the authenticated Owner ID.');
    assert(tables.filter((table) => table !== 'users' && table !== 'settings').every((table) => snapshot.tables[table].length === 0), 'Reset snapshot retained business data.');
    state.set(ownerId, 0);
  }, async (ownerId) => state.get(ownerId) ?? -1);
  assert(state.get('owner-a') === 0 && state.get('owner-b') === 8, 'Reset modified another Owner fixture.');

  let verificationCalled = false;
  try {
    await performOwnerReplacement('owner-a', resetSnapshot, async () => { throw new Error('simulated cloud failure'); }, async () => { verificationCalled = true; });
    throw new Error('Simulated cloud failure unexpectedly succeeded.');
  } catch (error) {
    assert(error instanceof Error && error.message === 'simulated cloud failure', 'Cloud failure was not preserved.');
    assert(!verificationCalled, 'Verification ran after a failed cloud replacement.');
  }

  console.log('store-admin logic OK: action-specific reset, settings schema, authorization, owner scoping, and failure boundaries validated');
}

void run();
