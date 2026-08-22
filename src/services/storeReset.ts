import { runInTransaction } from '@/database';
import { nowIso } from '@/database/ids';
import { defaultPaymentMethods, defaultScannerPreferences } from '@/services/appSettings';
import { deleteProductImage, isAppOwnedProductImage } from '@/services/productImages';

const preservedSettingKeys = ['owner_user_id', 'owner_pin_needs_change', 'security_lock_timeout_ms', 'sync_device_id'] as const;

export type StoreResetResult = {
  removedProductImages: number;
  failedProductImages: number;
};

export async function resetLocalStoreCompletely(cloudResetCompleted = false): Promise<StoreResetResult> {
  const productImageUris = await runInTransaction(async (db) => {
    const ownerId = (await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'owner_user_id'"))?.value;
    if (!ownerId) throw new Error('Owner account is unavailable. Store data was not reset.');
    const owner = await db.getFirstAsync<{ id: string; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE id = ? AND role = 'admin' AND status = 'active' AND deleted_at IS NULL",
      ownerId,
    );
    if (!owner?.password_hash) throw new Error('Owner account is unavailable. Store data was not reset.');

    const images = await db.getAllAsync<{ image_uri: string | null }>('SELECT image_uri FROM products WHERE image_uri IS NOT NULL');

    // Reverse dependency order from the current SQLite foreign keys.
    await db.execAsync(`
      DELETE FROM sale_refund_items;
      DELETE FROM sale_refunds;
      DELETE FROM sale_voids;
      DELETE FROM credit_payments;
      DELETE FROM credit_transactions;
      DELETE FROM sale_items;
      DELETE FROM stock_movements;
      DELETE FROM sales;
      DELETE FROM pending_sale_items;
      DELETE FROM pending_sales;
      DELETE FROM products;
      DELETE FROM categories;
      DELETE FROM customers;
      DELETE FROM sync_queue;
    `);
    await db.runAsync('DELETE FROM users WHERE id <> ?', ownerId);
    await db.runAsync(
      `DELETE FROM settings WHERE key NOT IN (${preservedSettingKeys.map(() => '?').join(', ')})`,
      ...preservedSettingKeys,
    );

    const now = nowIso();
    const defaults: [string, string][] = [
      ['store_name', 'Sari-sari Store'],
      ['owner_name', 'Owner'],
      ['store_address', ''],
      ['store_phone', ''],
      ['payment_methods', JSON.stringify(defaultPaymentMethods)],
      ['scanner_preferences', JSON.stringify(defaultScannerPreferences)],
      ['appearance_preference', 'system'],
      ['development_seeded', '0'],
      ['store_reset_completed', '1'],
    ];
    if (cloudResetCompleted) defaults.push(
      ['sync_restore_pending', '0'], ['sync_status', 'synced'], ['sync_last_success_at', now],
      ['sync_last_pull_at', now], ['sync_bootstrap_complete', '1'],
    );
    for (const [key, value] of defaults) {
      await db.runAsync('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', key, value, now);
    }

    const violations = await db.getAllAsync<Record<string, unknown>>('PRAGMA foreign_key_check');
    if (violations.length) throw new Error('Store data could not be reset safely. No local changes were kept.');
    const preservedOwner = await db.getFirstAsync<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', ownerId);
    if (preservedOwner?.password_hash !== owner.password_hash) throw new Error('Owner PIN preservation could not be verified. No local changes were kept.');

    return images.map((row) => row.image_uri).filter((uri): uri is string => Boolean(uri));
  });

  let removedProductImages = 0;
  let failedProductImages = 0;
  for (const uri of new Set(productImageUris)) {
    if (!isAppOwnedProductImage(uri)) continue;
    try { deleteProductImage(uri); removedProductImages += 1; }
    catch (error) { failedProductImages += 1; if (__DEV__) console.warn('Reset product-image cleanup failed:', error); }
  }
  return { removedProductImages, failedProductImages };
}
