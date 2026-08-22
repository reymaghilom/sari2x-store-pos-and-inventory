import { SQLiteDatabase } from 'expo-sqlite';

export type CustomerCreditSummary = {
  creditLimit: number;
  outstandingBalance: number;
  remainingCredit: number;
};

export function getRemainingCredit(creditLimit: number, outstandingBalance: number) {
  return Math.max(creditLimit - outstandingBalance, 0);
}

export function isCreditChargeAllowed(remainingCredit: number, chargeAmount: number) {
  return chargeAmount >= 0 && chargeAmount <= remainingCredit;
}

export function customerOutstandingBalanceSql(customerIdExpression: string) {
  return `MAX(0,
    COALESCE((SELECT SUM(ct.amount) FROM credit_transactions ct WHERE ct.customer_id = ${customerIdExpression} AND ct.deleted_at IS NULL), 0)
    - COALESCE((SELECT SUM(cp.amount) FROM credit_payments cp WHERE cp.customer_id = ${customerIdExpression} AND cp.deleted_at IS NULL), 0)
  )`;
}

export async function getCustomerCreditSummary(db: SQLiteDatabase, customerId: string): Promise<CustomerCreditSummary> {
  const row = await db.getFirstAsync<{ credit_limit: number; outstanding_balance: number }>(
    `SELECT c.credit_limit, ${customerOutstandingBalanceSql('c.id')} AS outstanding_balance
     FROM customers c
     WHERE c.id = ? AND c.deleted_at IS NULL`,
    customerId,
  );
  if (!row) throw new Error('Customer not found.');
  return {
    creditLimit: row.credit_limit,
    outstandingBalance: row.outstanding_balance,
    remainingCredit: getRemainingCredit(row.credit_limit, row.outstanding_balance),
  };
}
