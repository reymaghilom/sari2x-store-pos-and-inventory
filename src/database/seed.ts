import { hashCredential } from '@/database/credentials';
import { createId, nowIso } from '@/database/ids';
import { queueSync } from '@/database/syncQueue';
import { initialCredits, initialCustomers, products, transactions } from '@/services/mockData';
import type { SQLiteDatabase } from 'expo-sqlite';

const TEMPORARY_OWNER_PIN = '1234';

export async function seedDatabase(db: SQLiteDatabase) {
  const resetCompleted = (await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'store_reset_completed'"))?.value === '1';
  const developmentSeedEnabled = __DEV__ && process.env.EXPO_PUBLIC_ENABLE_DEVELOPMENT_SEED !== 'false' && !resetCompleted;
  const productCount = (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM products'))?.count ?? 0;
  const customerCount = (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM customers'))?.count ?? 0;
  const salesCount = (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sales'))?.count ?? 0;
  const existingOwnerId = (await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'owner_user_id'"))?.value;
  const existingOwner = existingOwnerId
    ? await db.getFirstAsync<{ id: string }>('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL', existingOwnerId)
    : null;
  const ownerId = existingOwner?.id ?? createId();
  const ownerUsername = existingOwner
    ? (await db.getFirstAsync<{ username: string }>('SELECT username FROM users WHERE id = ?', ownerId))?.username ?? 'owner'
    : (await db.getFirstAsync<{ id: string }>("SELECT id FROM users WHERE username = 'owner' COLLATE NOCASE AND deleted_at IS NULL"))
      ? `local-owner-${ownerId.slice(0, 8)}`
      : 'owner';
  const ownerHash = await hashCredential(ownerUsername, TEMPORARY_OWNER_PIN);
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    if (!existingOwner) {
      await db.runAsync('INSERT INTO users (id, name, username, password_hash, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ownerId, 'Owner', ownerUsername, ownerHash, 'admin', 'active', now, now);
      await queueSync(db, 'users', ownerId, 'create', { id: ownerId, name: 'Owner', username: ownerUsername, role: 'admin', status: 'active' });
      await db.runAsync("INSERT INTO settings (key, value, updated_at) VALUES ('owner_pin_needs_change', '1', ?) ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = excluded.updated_at", now);
    }
    await db.runAsync("INSERT INTO settings (key, value, updated_at) VALUES ('owner_user_id', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", ownerId, now);
    await db.runAsync("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('security_lock_timeout_ms', '300000', ?)", now);
    const primaryUser = { id: ownerId };
    if (developmentSeedEnabled && !productCount) {
      const categories = Array.from(new Set(products.map((product) => product.category)));
      for (const name of categories) await db.runAsync('INSERT OR IGNORE INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', `seed-category-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, now, now);
      for (const product of products) {
        const categoryId = `seed-category-${product.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const productId = `seed-product-${product.id}`;
        await db.runAsync('INSERT OR IGNORE INTO products (id, name, category_id, selling_price, cost_price, barcode, low_stock_threshold, description, image_uri, cached_stock, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)', productId, product.name, categoryId, product.price, product.costPrice, product.barcode, product.lowStockThreshold, product.description, null, product.stock, now, now);
        if (product.stock > 0) await db.runAsync('INSERT OR IGNORE INTO stock_movements (id, product_id, type, quantity, reason, reference, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', `seed-stock-${product.id}`, productId, 'stock_in', product.stock, 'Initial inventory', 'SEED', 'First-run sample stock', primaryUser?.id ?? null, now);
      }
    }
    if (developmentSeedEnabled && !customerCount) {
      for (const customer of initialCustomers) await db.runAsync('INSERT OR IGNORE INTO customers (id, full_name, phone, address, customer_type, discount_type, discount_value, allow_utang, credit_limit, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', `seed-customer-${customer.id}`, customer.name, customer.phone, customer.address ?? null, customer.customerType, customer.discountType, customer.discountValue, customer.allowUtang ? 1 : 0, customer.creditLimit, now, now);
      for (const credit of initialCredits) await db.runAsync('INSERT OR IGNORE INTO credit_transactions (id, customer_id, sale_id, amount, due_date, description, notes, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', `seed-${credit.id}`, `seed-customer-${credit.customerId}`, null, credit.amount, credit.dueDate, credit.description, credit.notes ?? null, credit.status, primaryUser?.id ?? null, now, now);
      for (const customer of initialCustomers) {
        const credit = initialCredits.find((item) => item.customerId === customer.id);
        const paid = credit ? credit.amount - credit.remaining : 0;
        if (credit && paid > 0) await db.runAsync('INSERT OR IGNORE INTO credit_payments (id, credit_transaction_id, customer_id, amount, payment_method, reference, notes, received_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', `seed-payment-${customer.id}`, `seed-${credit.id}`, `seed-customer-${customer.id}`, paid, 'Cash', 'SEED', 'Opening payment history', primaryUser?.id ?? null, now);
      }
    }
    if (developmentSeedEnabled && !salesCount) {
      const seedProduct = await db.getFirstAsync<{ id: string; name: string; cost_price: number }>('SELECT id, name, cost_price FROM products WHERE is_active = 1 ORDER BY created_at LIMIT 1');
      if (!seedProduct) throw new Error('Seed sales require at least one product.');
      for (let index = 0; index < transactions.length; index += 1) {
        const transaction = transactions[index]; const saleId = createId(); const cashierId = primaryUser.id; const createdAt = new Date(Date.now() - index * 3_600_000).toISOString();
        await db.runAsync('INSERT INTO sales (id, transaction_number, customer_id, cashier_id, payment_method, subtotal, discount, total, cash_received, change_amount, reference_number, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)', saleId, transaction.id, null, cashierId, 'Cash', transaction.amount, transaction.amount, transaction.amount, 0, 'SEED', transaction.status === 'Completed' ? 'completed' : 'held', createdAt);
        await db.runAsync('INSERT INTO sale_items (id, sale_id, product_id, product_name_snapshot, quantity, unit_price, cost_price, subtotal, created_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)', createId(), saleId, seedProduct.id, seedProduct.name, transaction.amount, seedProduct.cost_price, transaction.amount, createdAt);
      }
    }
    await db.runAsync('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', 'store_name', 'Sari-sari Store', now);
    await db.runAsync('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', 'development_seeded', developmentSeedEnabled && (!productCount || !customerCount || !salesCount) ? '1' : '0', now);
  });
}
