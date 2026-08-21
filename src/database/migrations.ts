import { CURRENT_SCHEMA_VERSION, migrationV1, migrationV2 } from '@/database/schema';
import type { SQLiteDatabase } from 'expo-sqlite';

export async function runMigrations(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrationV1);
      await db.execAsync('PRAGMA user_version = 1');
    });
    version = 1;
  }
  if (version < 2) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrationV2);
      await db.execAsync('PRAGMA user_version = 2');
    });
    version = 2;
  }
  if (version > CURRENT_SCHEMA_VERSION) throw new Error('Database schema is newer than this app version.');
}
