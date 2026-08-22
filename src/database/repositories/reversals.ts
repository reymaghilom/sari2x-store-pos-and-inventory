import { runInTransaction } from '@/database';
import { createId, nowIso } from '@/database/ids';
import { queueSync } from '@/database/syncQueue';
import { PaymentMethod } from '@/types';

type RefundMethod = Exclude<PaymentMethod, 'Utang'> | 'Credit reversal';
type SaleRow = { id: string; transaction_number: string; status: string; total: number; payment_method: PaymentMethod };
type ItemRow = { id: string; product_id: string; quantity: number; unit_price: number; subtotal: number };

async function validateActor(db: Parameters<Parameters<typeof runInTransaction>[0]>[0], actorId: string) {
  const actor = await db.getFirstAsync<{ role: string }>("SELECT role FROM users WHERE id = ? AND status = 'active' AND deleted_at IS NULL", actorId);
  if (actor?.role !== 'admin') throw new Error('Only an Admin can void or refund a completed sale.');
}

async function validateSale(db: Parameters<Parameters<typeof runInTransaction>[0]>[0], saleId: string) {
  const sale = await db.getFirstAsync<SaleRow>('SELECT id, transaction_number, status, total, payment_method FROM sales WHERE id = ? AND deleted_at IS NULL', saleId);
  if (!sale) throw new Error('Transaction not found.');
  if (sale.status !== 'completed') throw new Error('Only a completed transaction can be reversed.');
  return sale;
}

async function reverseUnpaidUtang(db: Parameters<Parameters<typeof runInTransaction>[0]>[0], sale: SaleRow, now: string) {
  if (sale.payment_method !== 'Utang') return;
  const credit = await db.getFirstAsync<{ id: string; payments: number }>(`SELECT ct.id, COUNT(cp.id) AS payments
    FROM credit_transactions ct LEFT JOIN credit_payments cp ON cp.credit_transaction_id = ct.id AND cp.deleted_at IS NULL
    WHERE ct.sale_id = ? AND ct.deleted_at IS NULL GROUP BY ct.id`, sale.id);
  if (!credit) throw new Error('The Utang record for this sale could not be found.');
  if (credit.payments > 0) throw new Error('This Utang already has a payment. Use a dedicated credit adjustment workflow.');
  await db.runAsync('UPDATE credit_transactions SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', now, now, credit.id);
  await queueSync(db, 'credit_transactions', credit.id, 'update', { deletedAt: now, reversalSaleId: sale.id });
}

async function restoreItems(db: Parameters<Parameters<typeof runInTransaction>[0]>[0], sale: SaleRow, actorId: string, reason: string, movementType: 'void_return' | 'refund_return', now: string, refundId?: string) {
  const items = await db.getAllAsync<ItemRow>('SELECT id, product_id, quantity, unit_price, subtotal FROM sale_items WHERE sale_id = ? AND deleted_at IS NULL', sale.id);
  if (!items.length) throw new Error('This sale has no item snapshots and cannot be safely reversed.');
  for (const item of items) {
    if (refundId) {
      const refundItemId = createId();
      await db.runAsync('INSERT INTO sale_refund_items (id, refund_id, sale_item_id, product_id, quantity, unit_price, subtotal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', refundItemId, refundId, item.id, item.product_id, item.quantity, item.unit_price, item.subtotal, now, now);
      await queueSync(db, 'sale_refund_items', refundItemId, 'create');
    }
    const movementId = createId();
    await db.runAsync('INSERT INTO stock_movements (id, product_id, type, quantity, reason, reference, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', movementId, item.product_id, movementType, item.quantity, reason, sale.transaction_number, `Reversal of sale item ${item.id}`, actorId, now, now);
    await db.runAsync('UPDATE products SET cached_stock = cached_stock + ?, updated_at = ? WHERE id = ?', item.quantity, now, item.product_id);
    await queueSync(db, 'stock_movements', movementId, 'create');
    await queueSync(db, 'products', item.product_id, 'update');
  }
  return items;
}

export async function voidSale(saleId: string, actorId: string, reason: string) {
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error('A reason is required.');
  return runInTransaction(async (db) => {
    await validateActor(db, actorId);
    const sale = await validateSale(db, saleId);
    const now = nowIso();
    await reverseUnpaidUtang(db, sale, now);
    const voidId = createId();
    await db.runAsync('INSERT INTO sale_voids (id, sale_id, amount, reason, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', voidId, sale.id, sale.total, cleanReason, actorId, now, now);
    await restoreItems(db, sale, actorId, cleanReason, 'void_return', now);
    const updated = await db.runAsync("UPDATE sales SET status = 'voided', updated_at = ? WHERE id = ? AND status = 'completed'", now, sale.id);
    if (updated.changes !== 1) throw new Error('This transaction was already reversed.');
    await queueSync(db, 'sale_voids', voidId, 'create');
    await queueSync(db, 'sales', sale.id, 'update');
  });
}

export async function refundSale(saleId: string, actorId: string, reason: string, requestedMethod: Exclude<PaymentMethod, 'Utang'>) {
  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error('A reason is required.');
  return runInTransaction(async (db) => {
    await validateActor(db, actorId);
    const sale = await validateSale(db, saleId);
    const now = nowIso();
    await reverseUnpaidUtang(db, sale, now);
    const method: RefundMethod = sale.payment_method === 'Utang' ? 'Credit reversal' : requestedMethod;
    const refundId = createId();
    const refundNumber = `#REF${Date.now()}${Math.floor(Math.random() * 90 + 10)}`;
    await db.runAsync('INSERT INTO sale_refunds (id, sale_id, refund_number, amount, refund_method, reason, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', refundId, sale.id, refundNumber, sale.total, method, cleanReason, actorId, now, now);
    await restoreItems(db, sale, actorId, cleanReason, 'refund_return', now, refundId);
    const updated = await db.runAsync("UPDATE sales SET status = 'refunded', updated_at = ? WHERE id = ? AND status = 'completed'", now, sale.id);
    if (updated.changes !== 1) throw new Error('This transaction was already reversed.');
    await queueSync(db, 'sale_refunds', refundId, 'create');
    await queueSync(db, 'sales', sale.id, 'update');
    return refundNumber;
  });
}
