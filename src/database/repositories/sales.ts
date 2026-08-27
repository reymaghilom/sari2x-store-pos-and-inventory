import { getDatabase, runInTransaction } from '@/database';
import { createId, nowIso } from '@/database/ids';
import { getCustomerCreditSummary, isUtangCheckoutAllowed } from '@/database/repositories/customerCredit';
import { queueSync } from '@/database/syncQueue';
import { nextTransactionNumber } from '@/database/transactionNumbers';
import { CartItem, CompletedSale, CustomerType, DiscountType, PaymentMethod, Transaction } from '@/types';
import { isValidNewDueDate } from '@/utils/date';
import { calculateDiscount, roundMoney } from '@/utils/discount';
import { peso } from '@/utils/format';

type SaleRow = {
  id: string; transaction_number: string; created_at: string; total: number; cashier: string;
  customer: string | null; payment_method: PaymentMethod;
  status: 'completed' | 'held' | 'voided' | 'refunded' | 'partially_refunded' | 'cancelled';
  due_date: string | null; notes: string | null; reversal_reason: string | null; reversed_by: string | null;
  reversed_at: string | null; refund_amount: number | null; refund_method: string | null;
};

type CheckoutCustomer = {
  id: string;
  full_name: string;
  customer_type: CustomerType;
  discount_type: DiscountType;
  discount_value: number;
  allow_utang: number;
};

export async function listSales(): Promise<Transaction[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<SaleRow>(`SELECT s.id, s.transaction_number, s.created_at, s.total, s.payment_method,
    COALESCE(NULLIF(s.cashier_name_snapshot, ''), u.name, 'Owner') AS cashier,
    COALESCE(NULLIF(s.customer_name_snapshot, ''), c.full_name) AS customer, s.status,
    COALESCE(v.reason, r.reason) AS reversal_reason, ru.name AS reversed_by, COALESCE(v.created_at, r.created_at) AS reversed_at,
    r.amount AS refund_amount, r.refund_method,
    (SELECT ct.due_date FROM credit_transactions ct WHERE ct.sale_id = s.id AND ct.deleted_at IS NULL LIMIT 1) AS due_date,
    (SELECT ct.notes FROM credit_transactions ct WHERE ct.sale_id = s.id AND ct.deleted_at IS NULL LIMIT 1) AS notes
    FROM sales s LEFT JOIN users u ON u.id = s.cashier_id
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN sale_voids v ON v.sale_id = s.id AND v.deleted_at IS NULL
    LEFT JOIN sale_refunds r ON r.sale_id = s.id AND r.deleted_at IS NULL
    LEFT JOIN users ru ON ru.id = COALESCE(v.created_by, r.created_by)
    WHERE s.deleted_at IS NULL ORDER BY s.created_at DESC`);
  const labels = { completed: 'Completed', held: 'Held', voided: 'Voided', refunded: 'Refunded', partially_refunded: 'Partially Refunded', cancelled: 'Cancelled' } as const;
  return rows.map((row) => ({ saleId: row.id, id: row.transaction_number, time: new Date(row.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }), amount: row.total, cashier: row.cashier, customer: row.customer ?? undefined, paymentMethod: row.payment_method, status: labels[row.status], dueDate: row.due_date ?? undefined, notes: row.notes ?? undefined, reversalReason: row.reversal_reason ?? undefined, reversedBy: row.reversed_by ?? undefined, reversedAt: row.reversed_at ? new Date(row.reversed_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : undefined, refundAmount: row.refund_amount ?? undefined, refundMethod: row.refund_method ?? undefined }));
}

export async function completeCheckout(input: {
  cart: CartItem[]; customerId: string | null; cashierId: string; method: PaymentMethod;
  cashReceived?: number; reference?: string; dueDate?: string; notes?: string;
  applyCustomerDiscount?: boolean;
}): Promise<CompletedSale> {
  return runInTransaction(async (db) => {
    if (!input.cart.length) throw new Error('Cart is empty.');
    const checkoutDate = new Date();
    const now = nowIso(checkoutDate);
    const dueDate = input.dueDate?.trim();
    if (input.method === 'Utang' && !isValidNewDueDate(dueDate ?? '')) throw new Error('Select today or a future due date.');

    const productRows = await Promise.all(input.cart.map((item) => db.getFirstAsync<{
      id: string; name: string; selling_price: number; cost_price: number; cached_stock: number;
    }>('SELECT id, name, selling_price, cost_price, cached_stock FROM products WHERE id = ? AND is_active = 1 AND deleted_at IS NULL', item.productId)));

    let subtotal = 0;
    for (let index = 0; index < input.cart.length; index += 1) {
      const item = input.cart[index];
      const product = productRows[index];
      if (!product) throw new Error('A cart product is unavailable.');
      if (!Number.isInteger(item.quantity) || item.quantity <= 0 || product.cached_stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}.`);
      subtotal = roundMoney(subtotal + product.selling_price * item.quantity);
    }

    const customer = input.customerId ? await db.getFirstAsync<CheckoutCustomer>(
      `SELECT id, full_name, customer_type, discount_type, discount_value, allow_utang
       FROM customers WHERE id = ? AND deleted_at IS NULL`, input.customerId,
    ) : null;
    const discountType: DiscountType = customer?.customer_type === 'suki' && input.applyCustomerDiscount !== false
      ? customer.discount_type : 'none';
    const discountValue = discountType === 'none' ? 0 : customer?.discount_value ?? 0;
    const pricing = calculateDiscount(subtotal, discountType, discountValue);
    const cashReceived = input.cashReceived === undefined ? undefined : roundMoney(input.cashReceived);
    if (cashReceived !== undefined && cashReceived < 0) throw new Error('Cash received must be zero or greater.');

    if (input.method === 'Utang') {
      if (!customer) throw new Error('Select a registered customer before using Utang.');
      if (!customer.allow_utang) throw new Error('This customer is not allowed to use Utang.');
      if (pricing.finalTotal <= 0) throw new Error('A fully discounted sale does not need Utang payment.');
      const credit = await getCustomerCreditSummary(db, customer.id);
      if (!isUtangCheckoutAllowed(Boolean(customer.allow_utang), credit.remainingCredit, pricing.finalTotal)) throw new Error(`Customer has only ${peso(credit.remainingCredit)} remaining credit.`);
    }
    if (input.method === 'Cash' && (cashReceived ?? 0) < pricing.finalTotal) throw new Error('Cash received is insufficient.');

    const cashier = await db.getFirstAsync<{ name: string }>('SELECT name FROM users WHERE id = ? AND status = ?', input.cashierId, 'active');
    if (!cashier) throw new Error('Cashier account is unavailable.');
    const owner = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'owner_name' AND deleted_at IS NULL");
    const cashierNameSnapshot = owner?.value?.trim() || cashier.name || 'Owner';
    const customerNameSnapshot = customer?.full_name ?? null;
    const saleId = createId();
    const transactionNumber = await nextTransactionNumber(db, checkoutDate);
    const change = input.method === 'Cash' ? roundMoney((cashReceived ?? 0) - pricing.finalTotal) : null;

    await db.runAsync(
      `INSERT INTO sales
       (id, transaction_number, customer_id, cashier_id, payment_method, subtotal, discount_type, discount_value, discount,
        total, cash_received, change_amount, reference_number, cashier_name_snapshot, customer_name_snapshot, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      saleId, transactionNumber, customer?.id ?? null, input.cashierId, input.method, pricing.subtotal,
      discountType, discountValue, pricing.discountAmount, pricing.finalTotal,
      input.method === 'Cash' ? cashReceived ?? null : null, change, input.reference?.trim() || null,
      cashierNameSnapshot, customerNameSnapshot, 'completed', now, now,
    );

    for (let index = 0; index < input.cart.length; index += 1) {
      const item = input.cart[index];
      const product = productRows[index]!;
      const itemId = createId();
      const movementId = createId();
      const itemSubtotal = roundMoney(product.selling_price * item.quantity);
      await db.runAsync('INSERT INTO sale_items (id, sale_id, product_id, product_name_snapshot, quantity, unit_price, cost_price, subtotal, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', itemId, saleId, product.id, product.name, item.quantity, product.selling_price, product.cost_price, itemSubtotal, now, now);
      await db.runAsync('INSERT INTO stock_movements (id, product_id, type, quantity, reason, reference, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', movementId, product.id, 'sale', item.quantity, 'POS sale', transactionNumber, null, input.cashierId, now, now);
      const stockUpdate = await db.runAsync('UPDATE products SET cached_stock = cached_stock - ?, updated_at = ? WHERE id = ? AND cached_stock >= ?', item.quantity, now, product.id, item.quantity);
      if (stockUpdate.changes !== 1) throw new Error(`Stock changed while checking out ${product.name}.`);
      await queueSync(db, 'sale_items', itemId, 'create', { id: itemId, saleId, productId: product.id, quantity: item.quantity, unitPrice: product.selling_price, subtotal: itemSubtotal });
      await queueSync(db, 'stock_movements', movementId, 'create', { id: movementId, productId: product.id, type: 'sale', quantity: item.quantity });
    }

    if (input.method === 'Utang' && customer && pricing.finalTotal > 0) {
      const creditId = createId();
      const description = `Product purchase: ${productRows.map((product) => product!.name).join(', ')}`;
      const notes = input.notes?.trim() || null;
      await db.runAsync('INSERT INTO credit_transactions (id, customer_id, sale_id, amount, due_date, description, notes, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', creditId, customer.id, saleId, pricing.finalTotal, dueDate!, description, notes, 'Due', input.cashierId, now, now);
      await queueSync(db, 'credit_transactions', creditId, 'create', { id: creditId, customerId: customer.id, saleId, amount: pricing.finalTotal, dueDate, description, notes, status: 'Due', createdBy: input.cashierId });
    }

    await queueSync(db, 'sales', saleId, 'create', {
      id: saleId, transactionNumber, customerId: customer?.id ?? null, cashierId: input.cashierId,
      paymentMethod: input.method, subtotal: pricing.subtotal, discountType, discountValue,
      discount: pricing.discountAmount, total: pricing.finalTotal, cashierNameSnapshot, customerNameSnapshot, status: 'completed',
    });
    return {
      saleId, id: transactionNumber,
      date: checkoutDate.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }),
      cashier: cashierNameSnapshot, customer: customerNameSnapshot ?? undefined, paymentMethod: input.method,
      subtotal: pricing.subtotal, discountType, discountValue, discount: pricing.discountAmount, total: pricing.finalTotal,
      cashReceived: input.method === 'Cash' ? cashReceived : undefined, change: change ?? undefined,
    };
  });
}
