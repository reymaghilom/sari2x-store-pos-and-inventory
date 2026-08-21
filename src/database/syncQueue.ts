import { createId, nowIso } from '@/database/ids';
import type { SQLiteDatabase } from 'expo-sqlite';
export async function queueSync(db: SQLiteDatabase, entityType: string, entityId: string, operation: 'create' | 'update' | 'delete', payload?: unknown) {
  const now = nowIso();
  await db.runAsync('INSERT INTO sync_queue (id, entity_type, entity_id, operation, payload, status, retry_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)', createId(), entityType, entityId, operation, payload === undefined ? null : JSON.stringify(payload), 'pending', now, now);
}
