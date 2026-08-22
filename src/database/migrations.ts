import { CURRENT_SCHEMA_VERSION, migrationV1, migrationV2, migrationV3, migrationV4, migrationV5, migrationV6 } from '@/database/schema';
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
  if (version < 3) {
    await db.execAsync('PRAGMA foreign_keys = OFF; PRAGMA legacy_alter_table = ON;');
    try {
      await db.withTransactionAsync(async () => {
        await db.execAsync(migrationV3);
        await db.execAsync('PRAGMA user_version = 3');
      });
      version = 3;
    } finally {
      await db.execAsync('PRAGMA legacy_alter_table = OFF; PRAGMA foreign_keys = ON;');
    }
  }
  if (version < 4) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrationV4);
      await db.execAsync('PRAGMA user_version = 4');
    });
    version = 4;
  }
  if (version < 5) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrationV5);
      await db.execAsync('PRAGMA user_version = 5');
    });
    version = 5;
  }
  if (version < 6) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(migrationV6);
      await db.execAsync('PRAGMA user_version = 6');
    });
    version = 6;
  }
  if (version > CURRENT_SCHEMA_VERSION) throw new Error('Database schema is newer than this app version.');
}
