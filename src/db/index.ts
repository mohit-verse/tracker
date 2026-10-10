import * as SQLite from 'expo-sqlite';
import { migrateDbIfNeeded } from './schema';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Initializes and returns the SQLite database connection, ensuring migrations are run.
 * This is safe to call multiple times; it will only initialize once.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    try {
      // expo-sqlite 14+ API
      const db = await SQLite.openDatabaseAsync('tracker.db');
      
      // Enable foreign keys
      await db.execAsync('PRAGMA foreign_keys = ON;');
      
      // Apply migrations
      await migrateDbIfNeeded(db);
      
      // Attempt legacy data migration if needed
      const { migrateLegacyDataIfNeeded } = require('./legacyMigration');
      await migrateLegacyDataIfNeeded(db);
      
      return db;
    } catch (error) {
      dbPromise = null;
      throw error;
    }
  })();

  return dbPromise;
}

export async function resetDatabaseConnection(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      await db.closeAsync();
    } catch (e) {
      // Ignore closing errors
    }
    dbPromise = null;
  }
}

/**
 * Helper to execute a function within an exclusive transaction.
 */
export async function withTransaction<T>(
  action: (tx: any) => Promise<T>
): Promise<T> {
  const db = await getDatabase();
  let result: T;
  await db.withExclusiveTransactionAsync(async (txn) => {
    result = await action(txn);
  });
  return result!;
}
