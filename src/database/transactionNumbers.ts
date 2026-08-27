import type { SQLiteDatabase } from 'expo-sqlite';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function transactionNumberPrefix(date: Date) {
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const year = pad(date.getFullYear() % 100);
  return `TXN-${month}${day}${year}-`;
}

/** Must be called inside the same write transaction that inserts the sale. */
export async function nextTransactionNumber(db: SQLiteDatabase, date: Date) {
  const prefix = transactionNumberPrefix(date);
  const row = await db.getFirstAsync<{ sequence: number | null }>(
    `SELECT MAX(CAST(SUBSTR(transaction_number, ?) AS INTEGER)) AS sequence
     FROM sales
     WHERE transaction_number LIKE ?`,
    prefix.length + 1,
    `${prefix}%`,
  );

  for (let sequence = (row?.sequence ?? 0) + 1; sequence <= 999; sequence += 1) {
    const candidate = `${prefix}${String(sequence).padStart(3, '0')}`;
    const collision = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM sales WHERE transaction_number = ? LIMIT 1',
      candidate,
    );
    if (!collision) return candidate;
  }

  throw new Error('The daily transaction number limit has been reached.');
}
