const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const quoted = (value) => [...value.matchAll(/'([^']+)'/g)].map((match) => match[1]);
const sameSet = (left, right) => left.size === right.size && [...left].every((value) => right.has(value));
const requireMatch = (source, pattern, label) => {
  const match = source.match(pattern);
  if (!match) throw new Error(`Could not inspect ${label}.`);
  return match[1];
};

const schema = read('src', 'database', 'schema.ts');
const backup = read('src', 'services', 'backup.ts');
const sync = read('src', 'database', 'repositories', 'sync.ts');
const reset = read('src', 'services', 'storeReset.ts');
const edge = read('supabase', 'functions', 'store-admin', 'logic.ts');

const sqliteTables = new Set([...schema.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)/gi)].map((match) => match[1]).filter((name) => !name.endsWith('_v2')));
const backupTables = new Set(quoted(requireMatch(backup, /type BackupTable = ([^;]+);/, 'backup table contract')));
const syncTables = new Set(quoted(requireMatch(sync, /syncEntityTypes = \[([^\]]+)\]/, 'sync table contract')));
const edgeTables = new Set(quoted(requireMatch(edge, /export const tables = \[([^\]]+)\]/, 'Edge Function table contract')));
const resetTables = new Set([...reset.matchAll(/DELETE FROM\s+(\w+)/gi)].map((match) => match[1]));

const expectedBackup = new Set([...sqliteTables].filter((table) => table !== 'sync_queue'));
const expectedReset = sqliteTables;
if (!sameSet(backupTables, expectedBackup)) throw new Error('Portable backup table coverage does not match SQLite.');
if (!sameSet(syncTables, edgeTables)) throw new Error('Mobile sync and Edge Function cloud table contracts differ.');
if (!sameSet(resetTables, expectedReset)) throw new Error('Local reset does not cover every business table in FK-safe cleanup.');

const portableSettings = new Set(quoted(requireMatch(backup, /portableSettingKeys = \[([^\]]+)\]/, 'portable settings')));
const mobileCloudSettings = new Set(quoted(requireMatch(sync, /cloudSettingKeys = new Set\(\[([^\]]+)\]\)/, 'mobile cloud settings')));
const edgeCloudSettings = new Set(quoted(requireMatch(edge, /cloudSettingKeys = new Set\(\[([^\]]+)\]\)/, 'Edge cloud settings')));
if (!sameSet(mobileCloudSettings, edgeCloudSettings)) throw new Error('Mobile and Edge Function cloud settings contracts differ.');
if (![...mobileCloudSettings].every((key) => portableSettings.has(key))) throw new Error('Cloud settings are missing from portable backup settings.');

const forbiddenPortableSettings = ['owner_user_id', 'owner_pin_needs_change', 'security_lock_timeout_ms', 'sync_device_id', 'sync_status', 'manual_backup_last_created_at', 'printer_selected_id'];
if (forbiddenPortableSettings.some((key) => portableSettings.has(key))) throw new Error('A device-local or security setting leaked into portable backup.');
if (/password_hash/.test(requireMatch(backup, /users:\s*\{\s*exportColumns:\s*\[([^\]]+)\]/, 'portable user fields'))) throw new Error('Owner PIN hash leaked into portable backup.');
if (!/MIN_SUPPORTED_BACKUP_SCHEMA_VERSION\s*=\s*5/.test(backup) || !/schema_version as number\)\s*<\s*MIN_SUPPORTED_BACKUP_SCHEMA_VERSION/.test(backup) || !/schema_version as number\)\s*>\s*CURRENT_SCHEMA_VERSION/.test(backup)) throw new Error('Index-only schema migration backup compatibility is not preserved.');
for (const field of ['customer_type', 'discount_type', 'discount_value', 'cashier_name_snapshot', 'customer_name_snapshot']) {
  if (!backup.includes(`'${field}'`) || !sync.includes(field) || !edge.includes(field)) throw new Error(`V7 field ${field} is missing from backup/sync/Edge compatibility.`);
}
if (!backup.includes("'allow_utang'") || !sync.includes('allow_utang') || !edge.includes('allow_utang')) throw new Error('Allow Utang is missing from backup/sync/Edge compatibility.');
if (!/backupOutstanding[\s\S]+row\.allow_utang \?\?/i.test(backup)) throw new Error('Older backup Allow Utang inference is missing.');

console.log(`Backup contract OK: ${sqliteTables.size} SQLite tables, ${backupTables.size} portable tables, ${syncTables.size} owner-scoped cloud tables, FK-safe reset coverage, and device-local secret exclusions validated`);
