export const tables = ['users', 'categories', 'products', 'stock_movements', 'customers', 'sales', 'sale_items', 'sale_voids', 'sale_refunds', 'sale_refund_items', 'credit_transactions', 'credit_payments', 'settings'] as const;
export type Table = typeof tables[number];
export type Row = Record<string, unknown>;
export type Snapshot = { snapshot_format: string; snapshot_version: number; tables: Record<Table, Row[]> };
export type ActionRequest = { action: 'status' } | { action: 'claim' } | { action: 'reset' } | { action: 'replace'; snapshot: Snapshot };

const idPattern = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|seed-[a-z0-9][a-z0-9-]{0,99})$/i;
const canonicalOwnerIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const cloudSettingKeys = new Set(['store_name', 'owner_name', 'store_address', 'store_phone', 'payment_methods']);
const common = ['created_at', 'updated_at', 'deleted_at', 'origin_device_id'];
const allowed: Record<Table, Set<string>> = {
  users: new Set(['id', 'name', 'username', 'role', 'status', ...common]),
  categories: new Set(['id', 'name', ...common]),
  products: new Set(['id', 'name', 'category_id', 'selling_price', 'cost_price', 'barcode', 'low_stock_threshold', 'description', 'is_active', ...common]),
  stock_movements: new Set(['id', 'product_id', 'type', 'quantity', 'reason', 'reference', 'notes', 'created_by', ...common]),
  customers: new Set(['id', 'full_name', 'phone', 'address', 'customer_type', 'discount_type', 'discount_value', 'allow_utang', 'credit_limit', ...common]),
  sales: new Set(['id', 'transaction_number', 'customer_id', 'cashier_id', 'payment_method', 'subtotal', 'discount_type', 'discount_value', 'discount', 'total', 'cash_received', 'change_amount', 'reference_number', 'cashier_name_snapshot', 'customer_name_snapshot', 'status', ...common]),
  sale_items: new Set(['id', 'sale_id', 'product_id', 'product_name_snapshot', 'quantity', 'unit_price', 'cost_price', 'subtotal', ...common]),
  sale_voids: new Set(['id', 'sale_id', 'amount', 'reason', 'created_by', ...common]),
  sale_refunds: new Set(['id', 'sale_id', 'refund_number', 'amount', 'refund_method', 'reason', 'created_by', ...common]),
  sale_refund_items: new Set(['id', 'refund_id', 'sale_item_id', 'product_id', 'quantity', 'unit_price', 'subtotal', ...common]),
  credit_transactions: new Set(['id', 'customer_id', 'sale_id', 'amount', 'due_date', 'description', 'notes', 'status', 'created_by', ...common]),
  credit_payments: new Set(['id', 'credit_transaction_id', 'customer_id', 'amount', 'payment_method', 'reference', 'notes', 'received_by', ...common]),
  settings: new Set(['key', 'value', 'updated_at', 'deleted_at', 'origin_device_id']),
};
const numeric: Partial<Record<Table, string[]>> = {
  products: ['selling_price', 'cost_price', 'low_stock_threshold', 'is_active'], stock_movements: ['quantity'], customers: ['discount_value', 'allow_utang', 'credit_limit'],
  sales: ['subtotal', 'discount_value', 'discount', 'total', 'cash_received', 'change_amount'], sale_items: ['quantity', 'unit_price', 'cost_price', 'subtotal'],
  sale_voids: ['amount'], sale_refunds: ['amount'], sale_refund_items: ['quantity', 'unit_price', 'subtotal'], credit_transactions: ['amount'], credit_payments: ['amount'],
};
const required: Record<Table, string[]> = {
  users: ['id', 'name', 'username', 'role', 'status', 'created_at', 'updated_at'], categories: ['id', 'name', 'created_at', 'updated_at'],
  products: ['id', 'name', 'selling_price', 'cost_price', 'low_stock_threshold', 'is_active', 'created_at', 'updated_at'],
  stock_movements: ['id', 'product_id', 'type', 'quantity', 'created_at', 'updated_at'], customers: ['id', 'full_name', 'phone', 'customer_type', 'discount_type', 'discount_value', 'allow_utang', 'credit_limit', 'created_at', 'updated_at'],
  sales: ['id', 'transaction_number', 'cashier_id', 'payment_method', 'subtotal', 'discount_type', 'discount_value', 'discount', 'total', 'cashier_name_snapshot', 'status', 'created_at', 'updated_at'],
  sale_items: ['id', 'sale_id', 'product_id', 'product_name_snapshot', 'quantity', 'unit_price', 'cost_price', 'subtotal', 'created_at', 'updated_at'],
  sale_voids: ['id', 'sale_id', 'amount', 'reason', 'created_by', 'created_at', 'updated_at'],
  sale_refunds: ['id', 'sale_id', 'refund_number', 'amount', 'refund_method', 'reason', 'created_by', 'created_at', 'updated_at'],
  sale_refund_items: ['id', 'refund_id', 'sale_item_id', 'product_id', 'quantity', 'unit_price', 'subtotal', 'created_at', 'updated_at'],
  credit_transactions: ['id', 'customer_id', 'amount', 'status', 'created_at', 'updated_at'],
  credit_payments: ['id', 'customer_id', 'amount', 'payment_method', 'created_at', 'updated_at'], settings: ['key', 'value', 'updated_at'],
};

export class StoreAdminValidationError extends Error {
  constructor(message: string, readonly stage: string, readonly publicMessage: string, readonly table?: Table, readonly fields: string[] = [], readonly status = 400) {
    super(message); this.name = 'StoreAdminValidationError';
  }
}

export type OwnerCandidateDiagnostic = {
  id: string;
  role: string | null;
  status: string | null;
  deleted: boolean;
  qualified: boolean;
  reasons: string[];
};

export class OwnerResolutionError extends Error {
  readonly stage = 'reset-preparation';
  readonly publicMessage = 'Cloud Owner profile could not be resolved safely.';
  constructor(readonly candidateCount: number, readonly candidates: OwnerCandidateDiagnostic[]) {
    super(`Expected exactly one canonical active Owner metadata row; found ${candidateCount}.`);
    this.name = 'OwnerResolutionError';
  }
}

const incomplete = (table: Table, fields: string[]) => new StoreAdminValidationError(
  `${table} record is missing required fields: ${fields.join(', ')}.`, 'snapshot-validation',
  table === 'settings' ? 'Cloud backup settings are incomplete.' : 'Cloud backup contains incomplete records.', table, fields,
);

export function getBearerToken(authorization: string | null) {
  if (!authorization?.toLowerCase().startsWith('bearer ') || !authorization.slice(7).trim()) throw new StoreAdminValidationError('Authorization Bearer token is missing.', 'authorization', 'Cloud backup needs sign-in.', undefined, [], 401);
  return authorization.slice(7);
}

export function validateSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StoreAdminValidationError('Snapshot payload is missing or invalid.', 'snapshot-validation', 'Cloud backup data is invalid.');
  const snapshot = value as Snapshot;
  if (snapshot.snapshot_format !== 'sari-sari-store-cloud-snapshot' || snapshot.snapshot_version !== 1 || !snapshot.tables || typeof snapshot.tables !== 'object') throw new StoreAdminValidationError('Snapshot format or version is unsupported.', 'snapshot-validation', 'Cloud backup format is not supported.');
  const suppliedTables = Object.keys(snapshot.tables);
  if (suppliedTables.length !== tables.length || suppliedTables.some((table) => !tables.includes(table as Table))) throw new StoreAdminValidationError('Snapshot table set is incomplete or unsupported.', 'snapshot-validation', 'Cloud backup tables are incomplete.');
  let total = 0;
  for (const table of tables) {
    const rows = snapshot.tables[table];
    if (!Array.isArray(rows)) throw new StoreAdminValidationError(`${table} is not an array.`, 'snapshot-validation', 'Cloud backup data is invalid.', table);
    total += rows.length;
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new StoreAdminValidationError(`${table} contains a non-object record.`, 'snapshot-validation', 'Cloud backup data is invalid.', table);
      const unsupported = Object.keys(row).filter((key) => key === 'owner_id' || !allowed[table].has(key));
      if (unsupported.length) throw new StoreAdminValidationError(`${table} contains unsupported fields: ${unsupported.join(', ')}.`, 'snapshot-validation', 'Cloud backup contains unsupported data.', table, unsupported);
      // Both SQLite and Supabase define settings.value as NOT NULL text. Empty
      // text remains valid for portable address and phone fields.
      const missing = required[table].filter((field) => row[field] === null || row[field] === undefined || (field !== 'value' && row[field] === ''));
      if (missing.length) throw incomplete(table, missing);
      if (table === 'settings' && typeof row.value !== 'string') throw new StoreAdminValidationError('settings.value must be text.', 'snapshot-validation', 'Cloud backup settings are invalid.', table, ['value']);
      const key = table === 'settings' ? row.key : row.id;
      if (typeof key !== 'string' || (table === 'settings' ? !cloudSettingKeys.has(key) : !idPattern.test(key))) throw new StoreAdminValidationError(`${table} identifier is invalid.`, 'snapshot-validation', 'Cloud backup contains an invalid identifier.', table, [table === 'settings' ? 'key' : 'id']);
      if (seen.has(key)) throw new StoreAdminValidationError(`${table} identifier is duplicated.`, 'snapshot-validation', 'Cloud backup contains duplicate records.', table, [table === 'settings' ? 'key' : 'id']);
      seen.add(key);
      for (const field of numeric[table] ?? []) if (row[field] !== null && row[field] !== undefined && (typeof row[field] !== 'number' || !Number.isFinite(row[field]))) throw new StoreAdminValidationError(`${table}.${field} must be numeric.`, 'snapshot-validation', 'Cloud backup contains an invalid number.', table, [field]);
      if (table === 'customers') {
        if (row.customer_type !== 'regular' && row.customer_type !== 'suki') throw new StoreAdminValidationError('customers.customer_type is invalid.', 'snapshot-validation', 'Cloud backup contains an invalid customer type.', table, ['customer_type']);
        if (!['none', 'percentage', 'fixed'].includes(String(row.discount_type))) throw new StoreAdminValidationError('customers.discount_type is invalid.', 'snapshot-validation', 'Cloud backup contains an invalid customer discount.', table, ['discount_type']);
        if ((row.discount_value as number) < 0 || (row.discount_type === 'percentage' && (row.discount_value as number) > 100)) throw new StoreAdminValidationError('customers.discount_value is out of range.', 'snapshot-validation', 'Cloud backup contains an invalid customer discount.', table, ['discount_value']);
        if (row.allow_utang !== 0 && row.allow_utang !== 1) throw new StoreAdminValidationError('customers.allow_utang is invalid.', 'snapshot-validation', 'Cloud backup contains an invalid Allow Utang value.', table, ['allow_utang']);
      }
      if (table === 'sales') {
        if (!['none', 'percentage', 'fixed'].includes(String(row.discount_type))) throw new StoreAdminValidationError('sales.discount_type is invalid.', 'snapshot-validation', 'Cloud backup contains an invalid sale discount snapshot.', table, ['discount_type']);
        if ((row.discount_value as number) < 0 || (row.discount_type === 'percentage' && (row.discount_value as number) > 100)) throw new StoreAdminValidationError('sales.discount_value is out of range.', 'snapshot-validation', 'Cloud backup contains an invalid sale discount snapshot.', table, ['discount_value']);
      }
      for (const field of ['created_at', 'updated_at']) if (row[field] !== undefined && (typeof row[field] !== 'string' || !Number.isFinite(Date.parse(row[field] as string)))) throw new StoreAdminValidationError(`${table}.${field} is not a valid date.`, 'snapshot-validation', 'Cloud backup contains an invalid date.', table, [field]);
    }
  }
  if (total > 50_000) throw new StoreAdminValidationError('Snapshot exceeds 50,000 records.', 'snapshot-validation', 'Cloud backup contains too many records.');
  validateRelationships(snapshot.tables);
  return snapshot;
}

export function validateActionRequest(value: unknown, snapshotValidator = validateSnapshot): ActionRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StoreAdminValidationError('Request body must be an object.', 'request-validation', 'Store administration request is invalid.');
  const body = value as Record<string, unknown>;
  const action = body.action;
  if (action !== 'status' && action !== 'claim' && action !== 'reset' && action !== 'replace') throw new StoreAdminValidationError('Action is unsupported.', 'request-validation', 'Unsupported store administration action.');
  const allowedKeys = action === 'replace' ? new Set(['action', 'snapshot']) : new Set(['action']);
  const unexpected = Object.keys(body).filter((key) => !allowedKeys.has(key));
  if (unexpected.length) throw new StoreAdminValidationError(`Unexpected request fields: ${unexpected.join(', ')}.`, 'request-validation', 'Store administration request contains unsupported data.', undefined, unexpected);
  if (action === 'replace') return { action, snapshot: snapshotValidator(body.snapshot) };
  return { action };
}

export function createResetSnapshot(owner: Row, now = new Date().toISOString()): Snapshot {
  const snapshot = { snapshot_format: 'sari-sari-store-cloud-snapshot', snapshot_version: 1, tables: {} } as Snapshot;
  for (const table of tables) snapshot.tables[table] = [];
  const { owner_id: _ownerId, ...trustedOwner } = owner;
  snapshot.tables.users = [trustedOwner];
  snapshot.tables.settings = [
    ['store_name', 'Sari-sari Store'], ['owner_name', 'Owner'], ['store_address', ''], ['store_phone', ''],
    ['payment_methods', JSON.stringify({ Cash: true, GCash: true, Maya: true, Utang: true })],
  ].map(([key, value]) => ({ key, value, updated_at: now, deleted_at: null, origin_device_id: 'store-admin-reset' }));
  return snapshot;
}

export function resolveCanonicalOwner(rows: Row[], authenticatedOwnerId: string): { owner: Row; diagnostics: OwnerCandidateDiagnostic[] } {
  const diagnostics = rows.map((row) => {
    const id = typeof row.id === 'string' ? row.id : '';
    const role = typeof row.role === 'string' ? row.role : null;
    const status = typeof row.status === 'string' ? row.status : null;
    const reasons: string[] = [];
    if (row.owner_id !== authenticatedOwnerId) reasons.push('different_store_owner');
    if (!canonicalOwnerIdPattern.test(id)) reasons.push('legacy_or_invalid_identifier');
    if (role !== 'admin') reasons.push('not_owner_role');
    if (status !== 'active') reasons.push('not_active');
    if (row.deleted_at !== null && row.deleted_at !== undefined) reasons.push('deleted');
    return { id, role, status, deleted: row.deleted_at !== null && row.deleted_at !== undefined, qualified: reasons.length === 0, reasons };
  });
  const candidates = diagnostics.filter((candidate) => candidate.qualified);
  if (candidates.length !== 1) throw new OwnerResolutionError(candidates.length, diagnostics);
  const selected = rows.find((row) => row.id === candidates[0].id);
  if (!selected) throw new OwnerResolutionError(0, diagnostics);
  const { owner_id: _ownerId, ...owner } = selected;
  return { owner, diagnostics };
}

export async function performOwnerReplacement<T>(
  ownerId: string,
  snapshot: Snapshot,
  replace: (verifiedOwnerId: string, trustedSnapshot: Snapshot) => Promise<void>,
  verify: (verifiedOwnerId: string, trustedSnapshot: Snapshot) => Promise<T>,
) {
  await replace(ownerId, snapshot);
  return verify(ownerId, snapshot);
}

function validateRelationships(data: Snapshot['tables']) {
  const ids = Object.fromEntries(tables.map((table) => [table, new Set(data[table].map((row) => String(table === 'settings' ? row.key : row.id))) ])) as Record<Table, Set<string>>;
  const requireRef = (table: Table, field: string, parent: Table, optional = false) => {
    for (const row of data[table]) {
      const value = row[field];
      if (optional && (value === null || value === undefined || value === '')) continue;
      if (typeof value !== 'string' || !ids[parent].has(value)) throw new StoreAdminValidationError(`${table}.${field} references a missing ${parent} record.`, 'relationship-validation', 'Cloud backup contains broken relationships.', table, [field]);
    }
  };
  requireRef('products', 'category_id', 'categories', true);
  requireRef('sales', 'customer_id', 'customers', true); requireRef('sales', 'cashier_id', 'users');
  requireRef('sale_items', 'sale_id', 'sales'); requireRef('sale_items', 'product_id', 'products');
  requireRef('stock_movements', 'product_id', 'products'); requireRef('stock_movements', 'created_by', 'users', true);
  requireRef('credit_transactions', 'customer_id', 'customers'); requireRef('credit_transactions', 'sale_id', 'sales', true); requireRef('credit_transactions', 'created_by', 'users', true);
  requireRef('credit_payments', 'credit_transaction_id', 'credit_transactions', true); requireRef('credit_payments', 'customer_id', 'customers'); requireRef('credit_payments', 'received_by', 'users', true);
  requireRef('sale_voids', 'sale_id', 'sales'); requireRef('sale_voids', 'created_by', 'users');
  requireRef('sale_refunds', 'sale_id', 'sales'); requireRef('sale_refunds', 'created_by', 'users');
  requireRef('sale_refund_items', 'refund_id', 'sale_refunds'); requireRef('sale_refund_items', 'sale_item_id', 'sale_items'); requireRef('sale_refund_items', 'product_id', 'products');
}
