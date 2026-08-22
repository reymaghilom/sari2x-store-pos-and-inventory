import { hashCredential } from '@/database/credentials'; import { getDatabase, runInTransaction } from '@/database'; import { nowIso } from '@/database/ids'; import { AppUser, UserRole } from '@/types';
type UserRow = { id: string; name: string; username: string; password_hash: string; role: UserRole; status: 'active' | 'disabled' };
export const OWNER_PIN_LENGTH = 4;
export const isValidOwnerPin = (pin: string) => /^\d{4}$/.test(pin);
async function ownerRow() {
  const db = await getDatabase();
  return db.getFirstAsync<UserRow>(`SELECT u.id, u.name, u.username, u.password_hash, u.role, u.status
    FROM users u JOIN settings s ON s.key = 'owner_user_id' AND s.value = u.id
    WHERE u.deleted_at IS NULL LIMIT 1`);
}
export async function getOwner(): Promise<AppUser> {
  const row = await ownerRow();
  if (!row) throw new Error('Owner account is unavailable.');
  return { id: row.id, name: 'Owner', username: row.username, role: 'admin' };
}
export async function authenticateOwnerPin(pin: string): Promise<AppUser | null> {
  if (!isValidOwnerPin(pin)) return null;
  const row = await ownerRow();
  if (!row || row.status !== 'active') return null;
  const hash = await hashCredential(row.username, pin);
  return hash === row.password_hash ? { id: row.id, name: 'Owner', username: row.username, role: 'admin' } : null;
}
export async function changeOwnerPin(currentPin: string, nextPin: string) {
  if (!isValidOwnerPin(currentPin) || !isValidOwnerPin(nextPin)) throw new Error('PINs must contain exactly 4 digits.');
  const row = await ownerRow();
  if (!row || row.status !== 'active') throw new Error('Owner account is unavailable.');
  if (await hashCredential(row.username, currentPin) !== row.password_hash) throw new Error('Current PIN is incorrect.');
  const nextHash = await hashCredential(row.username, nextPin);
  await runInTransaction(async (db) => {
    const now = nowIso();
    await db.runAsync('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', nextHash, now, row.id);
    await db.runAsync("INSERT INTO settings (key, value, updated_at) VALUES ('owner_pin_needs_change', '0', ?) ON CONFLICT(key) DO UPDATE SET value = '0', updated_at = excluded.updated_at", now);
  });
}
