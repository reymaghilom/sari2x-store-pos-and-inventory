import { getDatabase, runInTransaction } from '@/database';
import { createId, nowIso } from '@/database/ids';
import { CartItem, PendingSale } from '@/types';

type PendingRow = { id: string; customer_id: string | null; customer_name: string | null; discount: number; created_at: string };
type ItemRow = { pending_sale_id: string; product_id: string; quantity: number };

export async function listPendingSales(): Promise<PendingSale[]> {
  const db = await getDatabase();
  const [sales, items] = await Promise.all([
    db.getAllAsync<PendingRow>(`SELECT ps.id, ps.customer_id, c.full_name AS customer_name, ps.discount, ps.created_at
      FROM pending_sales ps LEFT JOIN customers c ON c.id = ps.customer_id
      ORDER BY ps.created_at DESC`),
    db.getAllAsync<ItemRow>('SELECT pending_sale_id, product_id, quantity FROM pending_sale_items ORDER BY created_at, id'),
  ]);
  return sales.map((sale) => ({
    id: sale.id,
    customerId: sale.customer_id ?? undefined,
    customerName: sale.customer_name ?? undefined,
    discount: sale.discount,
    createdAt: sale.created_at,
    items: items.filter((item) => item.pending_sale_id === sale.id).map((item) => ({ productId: item.product_id, quantity: item.quantity })),
  }));
}

export async function savePendingSale(items: CartItem[], customerId: string | null, discount = 0) {
  if (!items.length) throw new Error('The cart is empty.');
  const id = createId(); const now = nowIso();
  await runInTransaction(async (db) => {
    await db.runAsync('INSERT INTO pending_sales (id, customer_id, discount, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', id, customerId, discount, now, now);
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new Error('A pending item has an invalid quantity.');
      const product = await db.getFirstAsync<{ id: string }>('SELECT id FROM products WHERE id = ? AND is_active = 1 AND deleted_at IS NULL', item.productId);
      if (!product) throw new Error('A cart product is no longer available.');
      await db.runAsync('INSERT INTO pending_sale_items (id, pending_sale_id, product_id, quantity, created_at) VALUES (?, ?, ?, ?, ?)', createId(), id, item.productId, item.quantity, now);
    }
  });
  return id;
}

export async function loadPendingSaleForResume(id: string) {
  const db = await getDatabase();
  const sale = await db.getFirstAsync<{ customer_id: string | null; discount: number }>('SELECT customer_id, discount FROM pending_sales WHERE id = ?', id);
  if (!sale) throw new Error('This pending sale no longer exists.');
  const items = await db.getAllAsync<{ product_id: string; quantity: number; name: string | null; cached_stock: number | null }>(`SELECT psi.product_id, psi.quantity, p.name, p.cached_stock
    FROM pending_sale_items psi LEFT JOIN products p ON p.id = psi.product_id AND p.is_active = 1 AND p.deleted_at IS NULL
    WHERE psi.pending_sale_id = ? ORDER BY psi.created_at, psi.id`, id);
  if (!items.length) throw new Error('This pending sale has no items.');
  for (const item of items) {
    if (!item.name) throw new Error('A product in this pending sale is no longer available.');
    if ((item.cached_stock ?? 0) < item.quantity) throw new Error(`${item.name} now has only ${item.cached_stock ?? 0} in stock. Update the pending sale before checkout.`);
  }
  return { customerId: sale.customer_id, discount: sale.discount, items: items.map((item) => ({ productId: item.product_id, quantity: item.quantity })) };
}

export async function deletePendingSale(id: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM pending_sales WHERE id = ?', id);
}
