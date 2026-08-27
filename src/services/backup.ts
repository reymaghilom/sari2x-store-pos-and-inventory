import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDatabase, runInTransaction } from '@/database';
import { getLocalSetting, setLocalSetting } from '@/database/repositories/settings';
import { CURRENT_SCHEMA_VERSION } from '@/database/schema';

export const BACKUP_FORMAT = 'sari-sari-store';
export const BACKUP_VERSION = 1;
export const MIN_SUPPORTED_BACKUP_SCHEMA_VERSION = 5;
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
const portableSettingKeys = ['store_name', 'owner_name', 'store_address', 'store_phone', 'payment_methods', 'scanner_preferences', 'appearance_preference'] as const;

type BackupRow = Record<string, unknown>;
type BackupTable = 'users' | 'categories' | 'products' | 'customers' | 'sales' | 'sale_items' | 'stock_movements' | 'credit_transactions' | 'credit_payments' | 'sale_voids' | 'sale_refunds' | 'sale_refund_items' | 'pending_sales' | 'pending_sale_items' | 'settings';
export type BackupData = Record<BackupTable, BackupRow[]>;
export type SariStoreBackup = { backup_format: typeof BACKUP_FORMAT; backup_version: typeof BACKUP_VERSION; schema_version: number; created_at: string; app_version: string; data: BackupData };

type TableSpec = { exportColumns: string[]; restoreColumns: string[]; numeric?: string[] };
const specs: Record<BackupTable, TableSpec> = {
  users: { exportColumns: ['id', 'name', 'username', 'role', 'status', 'created_at', 'updated_at', 'deleted_at'], restoreColumns: ['id', 'name', 'username', 'password_hash', 'role', 'status', 'created_at', 'updated_at', 'deleted_at', 'origin_device_id'] },
  categories: { exportColumns: ['id', 'name', 'created_at', 'updated_at', 'deleted_at'], restoreColumns: ['id', 'name', 'created_at', 'updated_at', 'deleted_at', 'origin_device_id'] },
  products: { exportColumns: ['id', 'name', 'category_id', 'selling_price', 'cost_price', 'barcode', 'low_stock_threshold', 'description', 'cached_stock', 'is_active', 'created_at', 'updated_at', 'deleted_at'], restoreColumns: ['id', 'name', 'category_id', 'selling_price', 'cost_price', 'barcode', 'low_stock_threshold', 'description', 'image_uri', 'cached_stock', 'is_active', 'created_at', 'updated_at', 'deleted_at', 'origin_device_id'], numeric: ['selling_price', 'cost_price', 'low_stock_threshold', 'cached_stock', 'is_active'] },
  customers: { exportColumns: ['id', 'full_name', 'phone', 'address', 'customer_type', 'discount_type', 'discount_value', 'allow_utang', 'credit_limit', 'created_at', 'updated_at', 'deleted_at'], restoreColumns: ['id', 'full_name', 'phone', 'address', 'customer_type', 'discount_type', 'discount_value', 'allow_utang', 'credit_limit', 'created_at', 'updated_at', 'deleted_at', 'origin_device_id'], numeric: ['discount_value', 'allow_utang', 'credit_limit'] },
  sales: { exportColumns: ['id', 'transaction_number', 'customer_id', 'cashier_id', 'payment_method', 'subtotal', 'discount_type', 'discount_value', 'discount', 'total', 'cash_received', 'change_amount', 'reference_number', 'cashier_name_snapshot', 'customer_name_snapshot', 'status', 'created_at', 'updated_at', 'deleted_at'], restoreColumns: ['id', 'transaction_number', 'customer_id', 'cashier_id', 'payment_method', 'subtotal', 'discount_type', 'discount_value', 'discount', 'total', 'cash_received', 'change_amount', 'reference_number', 'cashier_name_snapshot', 'customer_name_snapshot', 'status', 'created_at', 'updated_at', 'deleted_at', 'origin_device_id'], numeric: ['subtotal', 'discount_value', 'discount', 'total', 'cash_received', 'change_amount'] },
  sale_items: { exportColumns: ['id', 'sale_id', 'product_id', 'product_name_snapshot', 'quantity', 'unit_price', 'cost_price', 'subtotal', 'created_at', 'updated_at', 'deleted_at'], restoreColumns: ['id', 'sale_id', 'product_id', 'product_name_snapshot', 'quantity', 'unit_price', 'cost_price', 'subtotal', 'created_at', 'updated_at', 'deleted_at', 'origin_device_id'], numeric: ['quantity', 'unit_price', 'cost_price', 'subtotal'] },
  stock_movements: { exportColumns: ['id', 'product_id', 'type', 'quantity', 'reason', 'reference', 'notes', 'created_by', 'created_at', 'updated_at', 'deleted_at'], restoreColumns: ['id', 'product_id', 'type', 'quantity', 'reason', 'reference', 'notes', 'created_by', 'created_at', 'updated_at', 'deleted_at', 'origin_device_id'], numeric: ['quantity'] },
  credit_transactions: { exportColumns: ['id', 'customer_id', 'sale_id', 'amount', 'due_date', 'description', 'notes', 'status', 'created_by', 'created_at', 'updated_at', 'deleted_at'], restoreColumns: ['id', 'customer_id', 'sale_id', 'amount', 'due_date', 'description', 'notes', 'status', 'created_by', 'created_at', 'updated_at', 'deleted_at', 'origin_device_id'], numeric: ['amount'] },
  credit_payments: { exportColumns: ['id', 'credit_transaction_id', 'customer_id', 'amount', 'payment_method', 'reference', 'notes', 'received_by', 'created_at', 'updated_at', 'deleted_at'], restoreColumns: ['id', 'credit_transaction_id', 'customer_id', 'amount', 'payment_method', 'reference', 'notes', 'received_by', 'created_at', 'updated_at', 'deleted_at', 'origin_device_id'], numeric: ['amount'] },
  sale_voids: { exportColumns: ['id', 'sale_id', 'amount', 'reason', 'created_by', 'created_at', 'updated_at', 'deleted_at'], restoreColumns: ['id', 'sale_id', 'amount', 'reason', 'created_by', 'created_at', 'updated_at', 'deleted_at', 'origin_device_id'], numeric: ['amount'] },
  sale_refunds: { exportColumns: ['id', 'sale_id', 'refund_number', 'amount', 'refund_method', 'reason', 'created_by', 'created_at', 'updated_at', 'deleted_at'], restoreColumns: ['id', 'sale_id', 'refund_number', 'amount', 'refund_method', 'reason', 'created_by', 'created_at', 'updated_at', 'deleted_at', 'origin_device_id'], numeric: ['amount'] },
  sale_refund_items: { exportColumns: ['id', 'refund_id', 'sale_item_id', 'product_id', 'quantity', 'unit_price', 'subtotal', 'created_at', 'updated_at', 'deleted_at'], restoreColumns: ['id', 'refund_id', 'sale_item_id', 'product_id', 'quantity', 'unit_price', 'subtotal', 'created_at', 'updated_at', 'deleted_at', 'origin_device_id'], numeric: ['quantity', 'unit_price', 'subtotal'] },
  pending_sales: { exportColumns: ['id', 'customer_id', 'discount', 'created_at', 'updated_at'], restoreColumns: ['id', 'customer_id', 'discount', 'created_at', 'updated_at'], numeric: ['discount'] },
  pending_sale_items: { exportColumns: ['id', 'pending_sale_id', 'product_id', 'quantity', 'created_at'], restoreColumns: ['id', 'pending_sale_id', 'product_id', 'quantity', 'created_at'], numeric: ['quantity'] },
  settings: { exportColumns: ['key', 'value', 'updated_at', 'deleted_at'], restoreColumns: ['key', 'value', 'updated_at', 'deleted_at', 'origin_device_id'] },
};
const tableNames = Object.keys(specs) as BackupTable[];

export class BackupValidationError extends Error {}

const pad = (value: number) => String(value).padStart(2, '0');
function fileTimestamp(date = new Date()) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`; }
function backupDirectory() { const directory = new Directory(Paths.document, 'backups'); directory.create({ idempotent: true, intermediates: true }); return directory; }

export async function createBackupSnapshot(): Promise<SariStoreBackup> {
  const data = await runInTransaction(async (db) => {
    const result = {} as BackupData;
    for (const table of tableNames) {
      const columns = specs[table].exportColumns.join(', ');
      result[table] = table === 'settings'
        ? await db.getAllAsync<BackupRow>(`SELECT ${columns} FROM settings WHERE key IN (${portableSettingKeys.map(() => '?').join(',')}) ORDER BY key`, ...portableSettingKeys)
        : await db.getAllAsync<BackupRow>(`SELECT ${columns} FROM ${table} ORDER BY id`);
    }
    return result;
  });
  return { backup_format: BACKUP_FORMAT, backup_version: BACKUP_VERSION, schema_version: CURRENT_SCHEMA_VERSION, created_at: new Date().toISOString(), app_version: Constants.expoConfig?.version ?? 'unknown', data };
}

async function writeBackupFile(backup: SariStoreBackup, prefix = 'sari-sari-store-backup') {
  const file = new File(backupDirectory(), `${prefix}-${fileTimestamp()}.json`);
  file.create({ overwrite: true, intermediates: true });
  file.write(JSON.stringify(backup, null, 2));
  return file;
}

export async function createAndShareJsonBackup() {
  const backup = await createBackupSnapshot();
  const file = await writeBackupFile(backup);
  await setLocalSetting('manual_backup_last_created_at', backup.created_at);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { dialogTitle: 'Save Sari-sari Store backup', mimeType: 'application/json', UTI: 'public.json' });
  return { fileUri: file.uri, fileName: file.name, backup };
}

export function getLastManualBackupAt() {
  return getLocalSetting('manual_backup_last_created_at');
}

const isObject = (value: unknown): value is BackupRow => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value);
function idSet(rows: BackupRow[]) { return new Set(rows.map((row) => row.id).filter((id): id is string => typeof id === 'string')); }
function requireReference(rows: BackupRow[], key: string, target: Set<string>, optional = false) { for (const row of rows) { const value = row[key]; if (optional && (value === null || value === undefined)) continue; if (!validId(value) || !target.has(value)) throw new BackupValidationError('A backup relationship is missing or invalid.'); } }

export function validateBackup(value: unknown): SariStoreBackup {
  if (!isObject(value) || value.backup_format !== BACKUP_FORMAT || value.backup_version !== BACKUP_VERSION || !Number.isInteger(value.schema_version) || (value.schema_version as number) < MIN_SUPPORTED_BACKUP_SCHEMA_VERSION || (value.schema_version as number) > CURRENT_SCHEMA_VERSION || !isObject(value.data)) throw new BackupValidationError('This is not a valid Sari-sari Store backup file.');
  const data = value.data as Partial<BackupData>;
  for (const table of tableNames) {
    const rows = data[table];
    if (!Array.isArray(rows) || rows.some((row) => !isObject(row))) throw new BackupValidationError('This backup is missing required business data.');
    const key = table === 'settings' ? 'key' : 'id'; const seen = new Set<string>();
    for (const row of rows) {
      if (!validId(row[key]) || seen.has(row[key] as string)) throw new BackupValidationError(`The backup contains an invalid or duplicate ${table} identifier.`);
      seen.add(row[key] as string);
      for (const field of specs[table].numeric ?? []) if (row[field] !== null && row[field] !== undefined && (typeof row[field] !== 'number' || !Number.isFinite(row[field]))) throw new BackupValidationError(`The backup contains an invalid number in ${table}.`);
    }
  }
  const complete = data as BackupData;
  for (const row of complete.customers) {
    if (row.customer_type !== undefined && row.customer_type !== 'regular' && row.customer_type !== 'suki') throw new BackupValidationError('The backup contains an invalid customer type.');
    if (row.discount_type !== undefined && !['none', 'percentage', 'fixed'].includes(String(row.discount_type))) throw new BackupValidationError('The backup contains an invalid customer discount type.');
    if (row.discount_type === 'percentage' && typeof row.discount_value === 'number' && row.discount_value > 100) throw new BackupValidationError('The backup contains an invalid percentage discount.');
    if (row.allow_utang !== undefined && row.allow_utang !== 0 && row.allow_utang !== 1) throw new BackupValidationError('The backup contains an invalid Allow Utang value.');
  }
  for (const row of complete.sales) {
    if (row.discount_type !== undefined && !['none', 'percentage', 'fixed'].includes(String(row.discount_type))) throw new BackupValidationError('The backup contains an invalid sale discount type.');
    if (row.discount_type === 'percentage' && typeof row.discount_value === 'number' && row.discount_value > 100) throw new BackupValidationError('The backup contains an invalid sale percentage discount.');
  }
  if (!complete.users.some((row) => row.role === 'admin')) throw new BackupValidationError('The backup does not contain Owner profile metadata.');
  const users = idSet(complete.users); const categories = idSet(complete.categories); const products = idSet(complete.products); const customers = idSet(complete.customers); const sales = idSet(complete.sales); const saleItems = idSet(complete.sale_items); const credits = idSet(complete.credit_transactions); const refunds = idSet(complete.sale_refunds); const pending = idSet(complete.pending_sales);
  requireReference(complete.products, 'category_id', categories, true);
  requireReference(complete.sales, 'customer_id', customers, true); requireReference(complete.sales, 'cashier_id', users);
  requireReference(complete.sale_items, 'sale_id', sales); requireReference(complete.sale_items, 'product_id', products);
  requireReference(complete.stock_movements, 'product_id', products); requireReference(complete.stock_movements, 'created_by', users, true);
  requireReference(complete.credit_transactions, 'customer_id', customers); requireReference(complete.credit_transactions, 'sale_id', sales, true); requireReference(complete.credit_transactions, 'created_by', users, true);
  requireReference(complete.credit_payments, 'credit_transaction_id', credits, true); requireReference(complete.credit_payments, 'customer_id', customers); requireReference(complete.credit_payments, 'received_by', users, true);
  requireReference(complete.sale_voids, 'sale_id', sales); requireReference(complete.sale_voids, 'created_by', users);
  requireReference(complete.sale_refunds, 'sale_id', sales); requireReference(complete.sale_refunds, 'created_by', users);
  requireReference(complete.sale_refund_items, 'refund_id', refunds); requireReference(complete.sale_refund_items, 'sale_item_id', saleItems); requireReference(complete.sale_refund_items, 'product_id', products);
  requireReference(complete.pending_sales, 'customer_id', customers, true); requireReference(complete.pending_sale_items, 'pending_sale_id', pending); requireReference(complete.pending_sale_items, 'product_id', products);
  return value as SariStoreBackup;
}

export async function readAndValidateBackup(uri: string, size?: number) {
  if (size !== undefined && size > MAX_BACKUP_BYTES) throw new BackupValidationError('The selected backup file is too large.');
  try { return validateBackup(JSON.parse(await new File(uri).text())); }
  catch (error) { if (error instanceof BackupValidationError) throw error; throw new BackupValidationError('This is not a valid Sari-sari Store backup file.'); }
}

async function insertRows(db: Awaited<ReturnType<typeof getDatabase>>, table: BackupTable, rows: BackupRow[], transform?: (row: BackupRow) => BackupRow) {
  const columns = specs[table].restoreColumns;
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  for (const source of rows) { const row = transform ? transform(source) : source; await db.runAsync(sql, ...columns.map((column) => { const value = row[column]; return typeof value === 'string' || typeof value === 'number' ? value : null; })); }
}

export async function restoreBackup(backup: SariStoreBackup) {
  const valid = validateBackup(backup);
  const safetyFile = await writeBackupFile(await createBackupSnapshot(), 'sari-sari-store-pre-restore');
  await runInTransaction(async (db) => {
    const ownerId = (await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'owner_user_id'"))?.value;
    const credentials = new Map((await db.getAllAsync<{ id: string; password_hash: string }>('SELECT id, password_hash FROM users')).map((row) => [row.id, row.password_hash]));
    const backupUserNames = new Map(valid.data.users.map((row) => [row.id, row.name]));
    const backupCustomerNames = new Map(valid.data.customers.map((row) => [row.id, row.full_name]));
    const backupOutstanding = new Map<string, number>();
    for (const row of valid.data.credit_transactions) if (!row.deleted_at && typeof row.customer_id === 'string' && typeof row.amount === 'number') backupOutstanding.set(row.customer_id, (backupOutstanding.get(row.customer_id) ?? 0) + row.amount);
    for (const row of valid.data.credit_payments) if (!row.deleted_at && typeof row.customer_id === 'string' && typeof row.amount === 'number') backupOutstanding.set(row.customer_id, (backupOutstanding.get(row.customer_id) ?? 0) - row.amount);
    const backupOwnerName = valid.data.settings.find((row) => row.key === 'owner_name')?.value;
    const backupOwnerId = valid.data.users.find((row) => row.role === 'admin')?.id as string | undefined;
    const mapUserReferences = (row: BackupRow, keys: string[]) => { if (!ownerId || !backupOwnerId || ownerId === backupOwnerId) return row; const mapped = { ...row }; for (const key of keys) if (mapped[key] === backupOwnerId) mapped[key] = ownerId; return mapped; };
    await db.execAsync(`DELETE FROM pending_sale_items; DELETE FROM pending_sales; DELETE FROM sale_refund_items; DELETE FROM sale_refunds; DELETE FROM sale_voids; DELETE FROM credit_payments; DELETE FROM credit_transactions; DELETE FROM sale_items; DELETE FROM stock_movements; DELETE FROM sales; DELETE FROM products; DELETE FROM categories; DELETE FROM customers;`);
    if (ownerId) await db.runAsync('DELETE FROM users WHERE id <> ?', ownerId); else await db.runAsync('DELETE FROM users');
    for (const key of portableSettingKeys) await db.runAsync('DELETE FROM settings WHERE key = ?', key);

    await insertRows(db, 'users', valid.data.users.filter((row) => row.id !== ownerId && row.id !== backupOwnerId), (row) => ({ ...row, password_hash: credentials.get(row.id as string) ?? 'restored-history-no-local-login', status: credentials.has(row.id as string) ? row.status : 'disabled', origin_device_id: null }));
    await insertRows(db, 'categories', valid.data.categories, (row) => ({ ...row, origin_device_id: null }));
    await insertRows(db, 'products', valid.data.products, (row) => ({ ...row, image_uri: null, origin_device_id: null }));
    await insertRows(db, 'customers', valid.data.customers, (row) => ({ ...row, customer_type: row.customer_type ?? 'regular', discount_type: row.discount_type ?? 'none', discount_value: row.discount_value ?? 0, allow_utang: row.allow_utang ?? ((typeof row.credit_limit === 'number' && row.credit_limit > 0) || (typeof row.id === 'string' && (backupOutstanding.get(row.id) ?? 0) > 0) ? 1 : 0), origin_device_id: null }));
    await insertRows(db, 'sales', valid.data.sales, (row) => ({ ...mapUserReferences(row, ['cashier_id']), discount_type: row.discount_type ?? 'none', discount_value: row.discount_value ?? 0, cashier_name_snapshot: row.cashier_name_snapshot ?? backupUserNames.get(row.cashier_id) ?? backupOwnerName ?? 'Owner', customer_name_snapshot: row.customer_name_snapshot ?? backupCustomerNames.get(row.customer_id) ?? null, origin_device_id: null }));
    await insertRows(db, 'sale_items', valid.data.sale_items, (row) => ({ ...row, origin_device_id: null }));
    await insertRows(db, 'stock_movements', valid.data.stock_movements, (row) => ({ ...mapUserReferences(row, ['created_by']), origin_device_id: null }));
    await insertRows(db, 'credit_transactions', valid.data.credit_transactions, (row) => ({ ...mapUserReferences(row, ['created_by']), origin_device_id: null }));
    await insertRows(db, 'credit_payments', valid.data.credit_payments, (row) => ({ ...mapUserReferences(row, ['received_by']), origin_device_id: null }));
    await insertRows(db, 'sale_voids', valid.data.sale_voids, (row) => ({ ...mapUserReferences(row, ['created_by']), origin_device_id: null }));
    await insertRows(db, 'sale_refunds', valid.data.sale_refunds, (row) => ({ ...mapUserReferences(row, ['created_by']), origin_device_id: null }));
    await insertRows(db, 'sale_refund_items', valid.data.sale_refund_items, (row) => ({ ...row, origin_device_id: null }));
    await insertRows(db, 'pending_sales', valid.data.pending_sales);
    await insertRows(db, 'pending_sale_items', valid.data.pending_sale_items);
    await insertRows(db, 'settings', valid.data.settings, (row) => ({ ...row, origin_device_id: null }));
    await db.runAsync(`UPDATE products SET cached_stock = MAX(0, COALESCE((SELECT SUM(CASE WHEN sm.type IN ('stock_in','void_return','refund_return') THEN sm.quantity ELSE -sm.quantity END) FROM stock_movements sm WHERE sm.product_id = products.id AND sm.deleted_at IS NULL), 0))`);
    const violations = await db.getAllAsync<BackupRow>('PRAGMA foreign_key_check');
    if (violations.length) throw new BackupValidationError('The backup contains broken record relationships.');
    await db.runAsync('DELETE FROM sync_queue');
    await db.runAsync("DELETE FROM settings WHERE key IN ('sync_last_success_at', 'sync_last_pull_at', 'sync_bootstrap_complete')");
    const now = new Date().toISOString();
    await db.runAsync("INSERT INTO settings (key, value, updated_at) VALUES ('sync_restore_pending', '1', ?) ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = excluded.updated_at", now);
    await db.runAsync("INSERT INTO settings (key, value, updated_at) VALUES ('sync_status', 'error', ?) ON CONFLICT(key) DO UPDATE SET value = 'error', updated_at = excluded.updated_at", now);
  });
  return { safetyBackupUri: safetyFile.uri, safetyBackupName: safetyFile.name };
}
