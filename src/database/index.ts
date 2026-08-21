import { runMigrations } from '@/database/migrations';
import { DATABASE_NAME } from '@/database/schema';
import { seedDatabase } from '@/database/seed';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

let initialization: Promise<SQLite.SQLiteDatabase> | null = null;
export function initializeDatabase() {
  if (!initialization) initialization = (async () => {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    await runMigrations(db);
    await seedDatabase(db);
    return db;
  })().catch((error) => { initialization = null; throw error; });
  return initialization;
}
export const getDatabase = initializeDatabase;
export async function runInTransaction<T>(task: (db: SQLite.SQLiteDatabase) => Promise<T>) {
  const db = await getDatabase(); let result: T | undefined;
  const execute = async (transaction: SQLite.SQLiteDatabase) => { result = await task(transaction); };
  if (Platform.OS === 'web') await db.withTransactionAsync(() => execute(db));
  else await db.withExclusiveTransactionAsync(execute);
  return result as T;
}
