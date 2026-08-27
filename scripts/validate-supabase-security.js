const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', '004_authenticated_owner_cloud.sql'), 'utf8');
const featureMigration = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', '005_customer_discounts_transaction_snapshots.sql'), 'utf8');
const utangPermissionMigration = fs.readFileSync(path.join(process.cwd(), 'supabase', 'migrations', '006_customer_utang_permission.sql'), 'utf8');
const edgeIndex = fs.readFileSync(path.join(process.cwd(), 'supabase', 'functions', 'store-admin', 'index.ts'), 'utf8');
const edgeLogic = fs.readFileSync(path.join(process.cwd(), 'supabase', 'functions', 'store-admin', 'logic.ts'), 'utf8');
const edge = `${edgeIndex}\n${edgeLogic}`;
const mobileAdmin = fs.readFileSync(path.join(process.cwd(), 'src', 'services', 'supabase', 'admin.ts'), 'utf8');
const resetScreen = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'reset-store.tsx'), 'utf8');
const tables = ['users', 'categories', 'products', 'customers', 'sales', 'sale_items', 'stock_movements', 'credit_transactions', 'credit_payments', 'sale_voids', 'sale_refunds', 'sale_refund_items', 'settings'];
const deleteOrder = ['sale_refund_items', 'sale_refunds', 'sale_voids', 'credit_payments', 'credit_transactions', 'sale_items', 'stock_movements', 'sales', 'products', 'categories', 'customers', 'users', 'settings'];

function requirePattern(value, pattern, message) {
  if (!pattern.test(value)) throw new Error(message);
}

for (const table of tables) {
  if (!migration.includes(`'${table}'`)) throw new Error(`Ownership migration is missing ${table}`);
}
requirePattern(migration, /add column if not exists owner_id uuid references auth\.users\(id\)/i, 'owner_id does not reference auth.users');
requirePattern(migration, /owner_id = auth\.uid\(\)/i, 'RLS is not scoped to auth.uid()');
requirePattern(migration, /create table if not exists public\.store_owners/i, 'Authenticated Owner registry is missing');
requirePattern(migration, /exists \(select 1 from public\.store_owners/i, 'Business policies do not require server-enrolled store ownership');
requirePattern(migration, /drop policy if exists dev_shared_select/i, 'Anonymous development SELECT policies are not removed');
requirePattern(migration, /revoke all[\s\S]+from public, anon/i, 'Anonymous/public table grants are not revoked');
if (/grant\s+[^;]*delete/i.test(migration)) throw new Error('Migration grants DELETE to a client role');
requirePattern(migration, /security definer/i, 'Privileged RPCs are not SECURITY DEFINER');
requirePattern(migration, /revoke all on function public\.admin_replace_owned_store[\s\S]+from public, anon, authenticated/i, 'Snapshot RPC remains callable by a mobile role');
requirePattern(migration, /grant execute on function public\.admin_replace_owned_store[\s\S]+to service_role/i, 'Snapshot RPC is not restricted to service_role');
requirePattern(featureMigration, /customer_type[\s\S]+discount_type[\s\S]+discount_value/i, 'Customer discount cloud migration is incomplete');
requirePattern(featureMigration, /cashier_name_snapshot[\s\S]+customer_name_snapshot/i, 'Immutable sale-name snapshots are missing from the cloud migration');
requirePattern(featureMigration, /set_config\('app\.store_admin', '1', true\)[\s\S]+update public\.sales/i, 'V7 historical snapshot backfill does not safely cooperate with the immutable-sale trigger');
requirePattern(featureMigration, /jsonb_to_recordset[\s\S]+customer_type[\s\S]+cashier_name_snapshot/i, 'Snapshot replacement RPC does not include V7 fields');
requirePattern(featureMigration, /revoke all on function public\.admin_replace_owned_store[\s\S]+service_role/i, 'V7 replacement RPC permissions are unsafe');
requirePattern(utangPermissionMigration, /allow_utang[\s\S]+check \(allow_utang in \(0, 1\)\)/i, 'Allow Utang cloud constraint is missing');
requirePattern(utangPermissionMigration, /credit_limit > 0[\s\S]+credit_transactions[\s\S]+credit_payments/i, 'Allow Utang cloud compatibility inference is incomplete');
requirePattern(utangPermissionMigration, /admin_replace_owned_store_v7[\s\S]+jsonb_to_recordset[\s\S]+allow_utang integer/i, 'V8 snapshot replacement wrapper is incomplete');
requirePattern(utangPermissionMigration, /revoke all on function public\.admin_replace_owned_store\(uuid, jsonb\)[\s\S]+service_role/i, 'V8 replacement RPC permissions are unsafe');

let previous = -1;
for (const table of deleteOrder) {
  const index = migration.indexOf(`delete from public.${table} where owner_id = p_owner_id`);
  if (index < 0 || index <= previous) throw new Error(`Unsafe or missing cloud delete order at ${table}`);
  previous = index;
}

requirePattern(edge, /authorization[\s\S]+auth\.getUser\(token\)/i, 'Edge Function does not validate the caller JWT');
requirePattern(edge, /STORE_OWNER_EMAIL/i, 'Edge Function has no server-side Owner allowlist');
requirePattern(edge, /from\('store_owners'\)\.upsert/i, 'Allowlisted Owner is not enrolled server-side');
requirePattern(edge, /SUPABASE_SERVICE_ROLE_KEY/i, 'Edge Function does not use a server-only privileged key');
requirePattern(edge, /key === 'owner_id'/i, 'Snapshot validator does not reject client-supplied ownership');
requirePattern(edge, /validateRelationships\(snapshot\.tables\)/i, 'Snapshot relationships are not validated');
requirePattern(edge, /verifySnapshot/i, 'Cloud replacement is not verified');
requirePattern(edge, /5 \* 1024 \* 1024/i, 'Snapshot payload size is not bounded');
requirePattern(edgeLogic, /if \(action === 'replace'\) return \{ action, snapshot: snapshotValidator\(body\.snapshot\) \}/i, 'Snapshot validation is not restricted to replace');
requirePattern(edgeLogic, /const allowedKeys = action === 'replace'[^;]+\['action', 'snapshot'\][^;]+\['action'\]/i, 'Reset still accepts a client snapshot');
requirePattern(edgeIndex, /body\.action === 'reset' \? await resetOwnerSnapshot\(service, ownerId\) : body\.snapshot/i, 'Reset does not use a server-created snapshot');
requirePattern(edgeIndex, /from\('users'\)\.select\(columns, \{ count: 'exact' \}\)\.eq\('owner_id', ownerId\)/i, 'Reset Owner profile query is not owner-scoped');
requirePattern(edgeLogic, /canonicalOwnerIdPattern[\s\S]+row\.owner_id !== authenticatedOwnerId[\s\S]+role !== 'admin'[\s\S]+status !== 'active'[\s\S]+row\.deleted_at/i, 'Canonical Owner selection is not deterministic and owner-scoped');
requirePattern(edgeLogic, /if \(candidates\.length !== 1\) throw new OwnerResolutionError/i, 'Ambiguous canonical Owner metadata is not rejected');
requirePattern(edgeIndex, /from\('store_owners'\)\.select\('owner_id'\)\.eq\('owner_id', ownerId\)/i, 'Owner enrollment is not verified');
requirePattern(edgeIndex, /console\.error\('store-admin failure',[\s\S]+action,[\s\S]+stage:[\s\S]+table:[\s\S]+fields:/i, 'Safe structured Edge failure logging is missing');
requirePattern(edgeIndex, /ownerCandidateCount:[\s\S]+ownerCandidates:/i, 'Safe canonical Owner diagnostics are missing');
requirePattern(mobileAdmin, /invokeStoreAdmin\(\{ action: 'reset' \}\)/i, 'Mobile reset still sends a snapshot');
if (/invokeStoreAdmin\(\{ action: 'reset',\s*snapshot/i.test(mobileAdmin)) throw new Error('Mobile reset sends local data to the privileged reset action');
requirePattern(resetScreen, /resetAuthenticatedCloudStore\(\)[\s\S]+resetLocalStoreCompletely/i, 'Local reset is not ordered after cloud reset');

console.log('Supabase security OK: authenticated ownership, anonymous-policy removal, service-role-only RPCs, FK-safe deletion, action-specific validation, JWT/email authorization, payload validation, and post-write verification validated');
