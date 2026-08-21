import { getDatabase, runInTransaction } from '@/database';
import { createId, nowIso } from '@/database/ids';
import { queueSync } from '@/database/syncQueue';
import { Product } from '@/types';

export type ProductInput = Omit<Product, 'id' | 'icon' | 'stock'> & { stock?: number; icon?: string };

type ProductRow = {
  id: string;
  name: string;
  category: string;
  selling_price: number;
  cost_price: number;
  barcode: string | null;
  low_stock_threshold: number;
  description: string | null;
  image_uri: string | null;
  cached_stock: number;
};

const productSelect = 'SELECT p.id, p.name, c.name AS category, p.selling_price, p.cost_price, p.barcode, p.low_stock_threshold, p.description, p.image_uri, p.cached_stock FROM products p LEFT JOIN categories c ON c.id = p.category_id';

const productIcon = (row: ProductRow) => row.image_uri || (
  row.category === 'Beverages'
    ? (row.name.includes('Sprite') ? '🍾' : '🥤')
    : row.category === 'Snacks'
      ? '🍜'
      : row.category === 'Personal Care'
        ? '🪥'
        : row.category === 'Household'
          ? '🧼'
          : '📦'
);

const mapProduct = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  category: row.category,
  price: row.selling_price,
  costPrice: row.cost_price,
  barcode: row.barcode ?? '',
  lowStockThreshold: row.low_stock_threshold,
  description: row.description ?? '',
  stock: row.cached_stock,
  icon: productIcon(row),
});

export class BarcodeConflictError extends Error {
  constructor() {
    super('This barcode is already assigned to another product.');
    this.name = 'BarcodeConflictError';
  }
}

export function isBarcodeConflictError(error: unknown): error is BarcodeConflictError {
  return error instanceof BarcodeConflictError;
}

function normalizeBarcode(barcode: string | null | undefined) {
  return barcode?.trim() ?? '';
}

function translateBarcodeConstraint(error: unknown): never {
  if (isBarcodeConflictError(error) || (error instanceof Error && error.message.includes('products.barcode'))) {
    throw new BarcodeConflictError();
  }
  throw error;
}

async function ensureBarcodeAvailable(
  db: Awaited<ReturnType<typeof getDatabase>>,
  barcode: string,
  excludedProductId?: string,
) {
  if (!barcode) return;
  const existing = excludedProductId
    ? await db.getFirstAsync<{ id: string }>('SELECT id FROM products WHERE barcode = ? AND id <> ? LIMIT 1', barcode, excludedProductId)
    : await db.getFirstAsync<{ id: string }>('SELECT id FROM products WHERE barcode = ? LIMIT 1', barcode);
  if (existing) throw new BarcodeConflictError();
}

export async function listProducts() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ProductRow>(`${productSelect} WHERE p.is_active = 1 AND p.deleted_at IS NULL ORDER BY p.created_at DESC`);
  return rows.map(mapProduct);
}

export async function findProductByBarcode(rawBarcode: string) {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) return null;
  const db = await getDatabase();
  const row = await db.getFirstAsync<ProductRow>(`${productSelect} WHERE p.barcode = ? AND p.is_active = 1 AND p.deleted_at IS NULL LIMIT 1`, barcode);
  return row ? mapProduct(row) : null;
}

async function ensureCategory(db: Awaited<ReturnType<typeof getDatabase>>, name: string) {
  const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM categories WHERE name = ? COLLATE NOCASE', name.trim());
  if (existing) return existing.id;
  const id = createId();
  const now = nowIso();
  await db.runAsync('INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', id, name.trim(), now, now);
  await queueSync(db, 'categories', id, 'create', { id, name: name.trim() });
  return id;
}

export async function createProduct(input: ProductInput) {
  const id = createId();
  const now = nowIso();
  const initialStock = input.stock ?? 0;
  const barcode = normalizeBarcode(input.barcode);
  try {
    await runInTransaction(async (db) => {
      await ensureBarcodeAvailable(db, barcode);
      const categoryId = await ensureCategory(db, input.category);
      await db.runAsync(
        'INSERT INTO products (id, name, category_id, selling_price, cost_price, barcode, low_stock_threshold, description, image_uri, cached_stock, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
        id, input.name, categoryId, input.price, input.costPrice, barcode || null, input.lowStockThreshold,
        input.description || null, input.icon || null, initialStock, now, now,
      );
      if (initialStock > 0) {
        const movementId = createId();
        await db.runAsync(
          'INSERT INTO stock_movements (id, product_id, type, quantity, reason, reference, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          movementId, id, 'stock_in', initialStock, 'Initial stock', null,
          'Stock entered when product was created', null, now, now,
        );
        await queueSync(db, 'stock_movements', movementId, 'create', { id: movementId, productId: id, type: 'stock_in', quantity: initialStock });
      }
      await queueSync(db, 'products', id, 'create', { ...input, barcode, id });
    });
  } catch (error) {
    translateBarcodeConstraint(error);
  }
  return id;
}

export async function updateProductRecord(id: string, input: Partial<ProductInput>) {
  const now = nowIso();
  try {
    await runInTransaction(async (db) => {
      const current = await db.getFirstAsync<ProductRow>(`${productSelect} WHERE p.id = ?`, id);
      if (!current) throw new Error('Product not found.');
      const category = input.category ?? current.category;
      const categoryId = await ensureCategory(db, category);
      const barcode = input.barcode === undefined ? normalizeBarcode(current.barcode) : normalizeBarcode(input.barcode);
      await ensureBarcodeAvailable(db, barcode, id);
      await db.runAsync(
        'UPDATE products SET name = ?, category_id = ?, selling_price = ?, cost_price = ?, barcode = ?, low_stock_threshold = ?, description = ?, image_uri = ?, updated_at = ? WHERE id = ?',
        input.name ?? current.name, categoryId, input.price ?? current.selling_price,
        input.costPrice ?? current.cost_price, barcode || null,
        input.lowStockThreshold ?? current.low_stock_threshold,
        input.description ?? current.description, input.icon ?? current.image_uri, now, id,
      );
      await queueSync(db, 'products', id, 'update', { ...input, ...(input.barcode === undefined ? {} : { barcode }) });
    });
  } catch (error) {
    translateBarcodeConstraint(error);
  }
}

export async function setProductActive(id: string, active: boolean) {
  const db = await getDatabase();
  const now = nowIso();
  await db.runAsync('UPDATE products SET is_active = ?, updated_at = ? WHERE id = ?', active ? 1 : 0, now, id);
  await queueSync(db, 'products', id, 'update', { is_active: active });
}
