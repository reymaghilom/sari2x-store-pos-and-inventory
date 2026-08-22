import { getDatabase } from '@/database';
import { PaymentMethod, SaleReceipt, SaleReceiptItem } from '@/types';

type ReceiptRow = {
  id: string;
  transaction_number: string;
  created_at: string;
  status: 'completed' | 'held' | 'voided' | 'refunded' | 'partially_refunded' | 'cancelled';
  cashier: string | null;
  customer: string | null;
  payment_method: PaymentMethod;
  subtotal: number;
  discount: number;
  total: number;
  cash_received: number | null;
  change_amount: number | null;
  reference_number: string | null;
  due_date: string | null;
  notes: string | null;
  reversal_reason: string | null;
  reversed_by: string | null;
  reversed_at: string | null;
  refund_amount: number | null;
  refund_method: string | null;
};

type ReceiptItemRow = {
  id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type SettingRow = { key: string; value: string };

export async function getSaleReceipt(saleId: string): Promise<SaleReceipt | null> {
  const db = await getDatabase();
  const sale = await db.getFirstAsync<ReceiptRow>(
    `SELECT
       s.id,
       s.transaction_number,
       s.created_at,
       s.status,
       u.name AS cashier,
       c.full_name AS customer,
       s.payment_method,
       s.subtotal,
       s.discount,
       s.total,
       s.cash_received,
       s.change_amount,
       s.reference_number,
       (SELECT ct.due_date
          FROM credit_transactions ct
         WHERE ct.sale_id = s.id AND ct.deleted_at IS NULL
         ORDER BY ct.created_at ASC
         LIMIT 1) AS due_date,
       (SELECT ct.notes
          FROM credit_transactions ct
         WHERE ct.sale_id = s.id AND ct.deleted_at IS NULL
         ORDER BY ct.created_at ASC
         LIMIT 1) AS notes,
       COALESCE(v.reason, r.reason) AS reversal_reason,
       ru.name AS reversed_by,
       COALESCE(v.created_at, r.created_at) AS reversed_at,
       r.amount AS refund_amount,
       r.refund_method
     FROM sales s
     LEFT JOIN users u ON u.id = s.cashier_id
     LEFT JOIN customers c ON c.id = s.customer_id
     LEFT JOIN sale_voids v ON v.sale_id = s.id AND v.deleted_at IS NULL
     LEFT JOIN sale_refunds r ON r.sale_id = s.id AND r.deleted_at IS NULL
     LEFT JOIN users ru ON ru.id = COALESCE(v.created_by, r.created_by)
     WHERE s.id = ? AND s.deleted_at IS NULL
     LIMIT 1`,
    saleId,
  );

  if (!sale) return null;

  const [itemRows, settingRows] = await Promise.all([
    db.getAllAsync<ReceiptItemRow>(
      `SELECT id, product_name_snapshot, quantity, unit_price, subtotal
         FROM sale_items
        WHERE sale_id = ? AND deleted_at IS NULL
        ORDER BY created_at ASC, id ASC`,
      sale.id,
    ),
    db.getAllAsync<SettingRow>(
      `SELECT key, value
         FROM settings
        WHERE key IN ('store_name', 'store_address', 'store_phone')
          AND deleted_at IS NULL`,
    ),
  ]);

  const settings = Object.fromEntries(settingRows.map((row) => [row.key, row.value]));
  const items: SaleReceiptItem[] = itemRows.map((row) => ({
    id: row.id,
    productName: row.product_name_snapshot,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: row.subtotal,
  }));

  return {
    saleId: sale.id,
    transactionNumber: sale.transaction_number,
    createdAt: sale.created_at,
    status: ({ completed: 'Completed', held: 'Held', voided: 'Voided', refunded: 'Refunded', partially_refunded: 'Partially Refunded', cancelled: 'Cancelled' } as const)[sale.status],
    cashier: sale.cashier ?? 'Unknown cashier',
    customer: sale.customer ?? 'Walk-in Customer',
    paymentMethod: sale.payment_method,
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    cashReceived: sale.cash_received ?? undefined,
    change: sale.change_amount ?? undefined,
    reference: sale.reference_number || undefined,
    dueDate: sale.due_date || undefined,
    notes: sale.notes || undefined,
    storeName: settings.store_name || 'Sari-sari Store',
    storeAddress: settings.store_address || undefined,
    storePhone: settings.store_phone || undefined,
    items,
    reversalReason: sale.reversal_reason ?? undefined,
    reversedBy: sale.reversed_by ?? undefined,
    reversedAt: sale.reversed_at ?? undefined,
    refundAmount: sale.refund_amount ?? undefined,
    refundMethod: sale.refund_method ?? undefined,
  };
}
