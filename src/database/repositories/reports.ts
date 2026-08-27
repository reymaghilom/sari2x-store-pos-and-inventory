import { getDatabase } from '@/database';
import { ReportSnapshot } from '@/types';
import { startOfLocalToday } from '@/utils/date';

export const financialSummarySql = `
WITH bounds AS (SELECT ? AS start_at, ? AS end_at),
base AS (
  SELECT
    COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.status IN ('completed','voided','refunded','partially_refunded') AND s.deleted_at IS NULL), 0) AS gross_sales,
    COALESCE((SELECT SUM(v.amount) FROM sale_voids v WHERE v.deleted_at IS NULL), 0) AS voided_sales,
    COALESCE((SELECT SUM(r.amount) FROM sale_refunds r WHERE r.deleted_at IS NULL), 0) AS refunds,
    COALESCE((SELECT SUM(si.cost_price * si.quantity) FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.status IN ('completed','voided','refunded','partially_refunded') AND s.deleted_at IS NULL AND si.deleted_at IS NULL), 0) AS sold_cogs,
    COALESCE((SELECT SUM(si.cost_price * si.quantity) FROM sale_voids v JOIN sale_items si ON si.sale_id = v.sale_id WHERE v.deleted_at IS NULL AND si.deleted_at IS NULL), 0) AS voided_cogs,
    COALESCE((SELECT SUM(si.cost_price * sri.quantity) FROM sale_refund_items sri JOIN sale_refunds r ON r.id = sri.refund_id JOIN sale_items si ON si.id = sri.sale_item_id WHERE sri.deleted_at IS NULL AND r.deleted_at IS NULL AND si.deleted_at IS NULL), 0) AS refunded_cogs,
    COALESCE((SELECT SUM(s.total) FROM sales s, bounds b WHERE s.status IN ('completed','voided','refunded','partially_refunded') AND s.deleted_at IS NULL AND s.created_at >= b.start_at AND s.created_at < b.end_at), 0) AS today_gross_sales,
    COALESCE((SELECT SUM(v.amount) FROM sale_voids v, bounds b WHERE v.deleted_at IS NULL AND v.created_at >= b.start_at AND v.created_at < b.end_at), 0) AS today_voided_sales,
    COALESCE((SELECT SUM(r.amount) FROM sale_refunds r, bounds b WHERE r.deleted_at IS NULL AND r.created_at >= b.start_at AND r.created_at < b.end_at), 0) AS today_refunds,
    COALESCE((SELECT SUM(si.cost_price * si.quantity) FROM sale_items si JOIN sales s ON s.id = si.sale_id, bounds b WHERE s.status IN ('completed','voided','refunded','partially_refunded') AND s.deleted_at IS NULL AND si.deleted_at IS NULL AND s.created_at >= b.start_at AND s.created_at < b.end_at), 0) AS today_sold_cogs,
    COALESCE((SELECT SUM(si.cost_price * si.quantity) FROM sale_voids v JOIN sale_items si ON si.sale_id = v.sale_id, bounds b WHERE v.deleted_at IS NULL AND si.deleted_at IS NULL AND v.created_at >= b.start_at AND v.created_at < b.end_at), 0) AS today_voided_cogs,
    COALESCE((SELECT SUM(si.cost_price * sri.quantity) FROM sale_refund_items sri JOIN sale_refunds r ON r.id = sri.refund_id JOIN sale_items si ON si.id = sri.sale_item_id, bounds b WHERE sri.deleted_at IS NULL AND r.deleted_at IS NULL AND si.deleted_at IS NULL AND r.created_at >= b.start_at AND r.created_at < b.end_at), 0) AS today_refunded_cogs
)
SELECT
  gross_sales,
  voided_sales,
  refunds,
  gross_sales - voided_sales - refunds AS net_sales,
  (gross_sales - voided_sales - refunds) - (sold_cogs - voided_cogs - refunded_cogs) AS total_profit,
  today_gross_sales - today_voided_sales - today_refunds AS today_sales,
  (today_gross_sales - today_voided_sales - today_refunds) - (today_sold_cogs - today_voided_cogs - today_refunded_cogs) AS today_profit
FROM base
`;

type FinancialSummary = {
  gross_sales: number;
  voided_sales: number;
  refunds: number;
  net_sales: number;
  total_profit: number;
  today_sales: number;
  today_profit: number;
};

export async function getReportSnapshot(): Promise<ReportSnapshot> {
  const db = await getDatabase();
  const todayStart = startOfLocalToday();
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const financial = await db.getFirstAsync<FinancialSummary>(financialSummarySql, todayStart.toISOString(), tomorrow.toISOString());
  const sales = await db.getFirstAsync<{ transaction_count: number; voided_count: number; refunded_count: number }>(`SELECT COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS transaction_count, COALESCE(SUM(CASE WHEN status = 'voided' THEN 1 ELSE 0 END), 0) AS voided_count, COALESCE(SUM(CASE WHEN status IN ('refunded','partially_refunded') THEN 1 ELSE 0 END), 0) AS refunded_count FROM sales WHERE deleted_at IS NULL`);
  const topProducts = await db.getAllAsync<{ name: string; quantity: number; total: number }>(`SELECT si.product_name_snapshot AS name, SUM(si.quantity) AS quantity, SUM(CASE WHEN s.subtotal > 0 THEN si.subtotal * s.total / s.subtotal ELSE 0 END) AS total FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.status = 'completed' AND s.deleted_at IS NULL AND si.deleted_at IS NULL GROUP BY si.product_name_snapshot ORDER BY quantity DESC LIMIT 5`);
  const byCashier = await db.getAllAsync<{ name: string; total: number; gross: number; voids: number; refunds: number; count: number }>(`SELECT COALESCE(NULLIF(s.cashier_name_snapshot, ''), u.name, 'Owner') AS name, COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total ELSE 0 END), 0) AS total, COALESCE(SUM(CASE WHEN s.status IN ('completed','voided','refunded','partially_refunded') THEN s.total ELSE 0 END), 0) AS gross, COALESCE(SUM(CASE WHEN s.status = 'voided' THEN s.total ELSE 0 END), 0) AS voids, COALESCE(SUM(CASE WHEN s.status IN ('refunded','partially_refunded') THEN s.total ELSE 0 END), 0) AS refunds, SUM(CASE WHEN s.status = 'completed' THEN 1 ELSE 0 END) AS count FROM sales s LEFT JOIN users u ON s.cashier_id = u.id WHERE s.deleted_at IS NULL GROUP BY COALESCE(NULLIF(s.cashier_name_snapshot, ''), u.name, 'Owner') ORDER BY name`);
  const inventory = await db.getFirstAsync<{ total_products: number; inventory_value: number; low_stock: number; out_of_stock: number }>(`SELECT COUNT(*) AS total_products, COALESCE(SUM(cost_price * cached_stock), 0) AS inventory_value, COALESCE(SUM(CASE WHEN cached_stock > 0 AND cached_stock <= low_stock_threshold THEN 1 ELSE 0 END), 0) AS low_stock, COALESCE(SUM(CASE WHEN cached_stock = 0 THEN 1 ELSE 0 END), 0) AS out_of_stock FROM products WHERE is_active = 1 AND deleted_at IS NULL`);
  const utang = await db.getFirstAsync<{ outstanding: number; collected: number; customers_count: number; overdue: number }>(`SELECT MAX(0, COALESCE((SELECT SUM(amount) FROM credit_transactions WHERE deleted_at IS NULL), 0) - COALESCE((SELECT SUM(amount) FROM credit_payments WHERE deleted_at IS NULL), 0)) AS outstanding, COALESCE((SELECT SUM(amount) FROM credit_payments WHERE deleted_at IS NULL), 0) AS collected, (SELECT COUNT(*) FROM customers c WHERE c.deleted_at IS NULL AND COALESCE((SELECT SUM(amount) FROM credit_transactions WHERE customer_id = c.id AND deleted_at IS NULL), 0) > COALESCE((SELECT SUM(amount) FROM credit_payments WHERE customer_id = c.id AND deleted_at IS NULL), 0)) AS customers_count, (SELECT COUNT(*) FROM credit_transactions WHERE status = 'Overdue' AND deleted_at IS NULL) AS overdue`);
  const totalSales = financial?.net_sales ?? 0;
  const transactionCount = sales?.transaction_count ?? 0;
  return {
    sales: {
      totalSales,
      grossSales: financial?.gross_sales ?? 0,
      voidedSales: financial?.voided_sales ?? 0,
      refunds: financial?.refunds ?? 0,
      netSales: totalSales,
      todaySales: financial?.today_sales ?? 0,
      todayProfit: financial?.today_profit ?? 0,
      totalProfit: financial?.total_profit ?? 0,
      transactionCount,
      voidedCount: sales?.voided_count ?? 0,
      refundedCount: sales?.refunded_count ?? 0,
      averageSale: transactionCount ? totalSales / transactionCount : 0,
      topProducts,
      byCashier,
    },
    inventory: { totalProducts: inventory?.total_products ?? 0, inventoryValue: inventory?.inventory_value ?? 0, lowStock: inventory?.low_stock ?? 0, outOfStock: inventory?.out_of_stock ?? 0 },
    utang: { totalOutstanding: utang?.outstanding ?? 0, totalCollected: utang?.collected ?? 0, customersWithUtang: utang?.customers_count ?? 0, overdue: utang?.overdue ?? 0 },
  };
}
