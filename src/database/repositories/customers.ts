import { getDatabase, runInTransaction } from '@/database';
import { createId, nowIso } from '@/database/ids';
import { customerOutstandingBalanceSql, getRemainingCredit } from '@/database/repositories/customerCredit';
import { queueSync } from '@/database/syncQueue';
import { Customer, CustomerType, DiscountType } from '@/types';
import { localDateToStorage } from '@/utils/date';
import { validateDiscount } from '@/utils/discount';

export type CustomerInput = {
  name: string;
  phone: string;
  address?: string;
  customerType: CustomerType;
  discountType: DiscountType;
  discountValue: number;
  allowUtang: boolean;
  creditLimit: number;
};

type CustomerRow = {
  id: string;
  full_name: string;
  phone: string;
  address: string | null;
  customer_type: CustomerType;
  discount_type: DiscountType;
  discount_value: number;
  allow_utang: number;
  credit_limit: number;
  outstanding_balance: number;
  overdue: number;
};

function normalizeCustomer(input: CustomerInput): CustomerInput {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const creditLimit = Number(input.creditLimit);
  if (!name) throw new Error('Customer name is required.');
  if (!phone) throw new Error('Phone number is required.');
  if (!Number.isFinite(creditLimit) || creditLimit < 0) throw new Error('Credit limit must be zero or greater.');

  const customerType = input.customerType === 'suki' ? 'suki' : 'regular';
  const discountType = customerType === 'suki' ? input.discountType : 'none';
  const discountValue = customerType === 'suki' ? Number(input.discountValue) : 0;
  validateDiscount(discountType, discountValue);

  return {
    name,
    phone,
    address: input.address?.trim() || undefined,
    customerType,
    discountType,
    discountValue,
    allowUtang: Boolean(input.allowUtang),
    creditLimit,
  };
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.full_name,
    phone: row.phone,
    address: row.address ?? undefined,
    customerType: row.customer_type,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    allowUtang: Boolean(row.allow_utang),
    creditLimit: row.credit_limit,
    utang: row.outstanding_balance,
    remainingCredit: getRemainingCredit(row.credit_limit, row.outstanding_balance),
    overdue: Boolean(row.overdue),
  };
}

export async function listCustomers(): Promise<Customer[]> {
  const db = await getDatabase();
  const today = localDateToStorage(new Date());
  const rows = await db.getAllAsync<CustomerRow>(
    `SELECT c.id, c.full_name, c.phone, c.address, c.customer_type, c.discount_type, c.discount_value, c.allow_utang,
      c.credit_limit, ${customerOutstandingBalanceSql('c.id')} AS outstanding_balance,
      EXISTS(
        SELECT 1 FROM credit_transactions ct
        WHERE ct.customer_id = c.id AND ct.deleted_at IS NULL AND ct.due_date < ?
          AND ct.amount > COALESCE((
            SELECT SUM(cp.amount) FROM credit_payments cp
            WHERE cp.credit_transaction_id = ct.id AND cp.deleted_at IS NULL
          ), 0)
      ) AS overdue
     FROM customers c
     WHERE c.deleted_at IS NULL
     ORDER BY c.created_at DESC`,
    today,
  );
  return rows.map(mapCustomer);
}

export async function createCustomer(rawInput: CustomerInput) {
  const input = normalizeCustomer(rawInput);
  const id = createId();
  const now = nowIso();
  await runInTransaction(async (db) => {
    await db.runAsync(
      `INSERT INTO customers
       (id, full_name, phone, address, customer_type, discount_type, discount_value, allow_utang, credit_limit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, input.name, input.phone, input.address || null, input.customerType, input.discountType,
      input.discountValue, input.allowUtang ? 1 : 0, input.creditLimit, now, now,
    );
    await queueSync(db, 'customers', id, 'create', { ...input, id });
  });
  return id;
}

export async function updateCustomer(id: string, rawInput: CustomerInput) {
  const input = normalizeCustomer(rawInput);
  const now = nowIso();
  await runInTransaction(async (db) => {
    const customer = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL', id,
    );
    if (!customer) throw new Error('Customer not found.');
    await db.runAsync(
      `UPDATE customers SET full_name = ?, phone = ?, address = ?, customer_type = ?, discount_type = ?,
       discount_value = ?, allow_utang = ?, credit_limit = ?, updated_at = ? WHERE id = ?`,
      input.name, input.phone, input.address || null, input.customerType, input.discountType,
      input.discountValue, input.allowUtang ? 1 : 0, input.creditLimit, now, id,
    );
    await queueSync(db, 'customers', id, 'update', { ...input, id });
  });
}
