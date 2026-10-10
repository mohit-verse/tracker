import { SQLiteDatabase } from 'expo-sqlite';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export type OutboxOperationType = 'INSERT' | 'UPDATE' | 'DELETE';
export type OutboxStatus = 'pending' | 'processing' | 'failed';

export interface OutboxEntry {
  id: string;
  operation_type: OutboxOperationType;
  entity_type: string;
  entity_id: string;
  payload: string | null;
  created_at: string;
  retry_count: number;
  status: OutboxStatus;
  error_info: string | null;
  claimed_at: string | null;
  claimed_by: string | null;
}

/**
 * Enqueue a mutation to the outbox.
 * MUST be called within the same SQLite transaction as the business logic mutation.
 */
export async function enqueueOutboxOperation(
  tx: SQLiteDatabase,
  operationType: OutboxOperationType,
  entityType: string,
  entityId: string,
  payload: any | null = null
): Promise<string> {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const payloadStr = payload ? JSON.stringify(payload) : null;

  await tx.runAsync(
    `INSERT INTO sync_outbox (
      id, operation_type, entity_type, entity_id, payload, created_at, retry_count, status, error_info
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 'pending', NULL)`,
    [id, operationType, entityType, entityId, payloadStr, createdAt]
  );

  return id;
}

/**
 * Retrieves all pending outbox entries ordered by creation time.
 */
export async function getPendingOutboxEntries(db: SQLiteDatabase): Promise<OutboxEntry[]> {
  return db.getAllAsync<OutboxEntry>(
    `SELECT * FROM sync_outbox WHERE status = 'pending' ORDER BY created_at ASC`
  );
}

/**
 * Marks an outbox entry as processing.
 */
export async function markOutboxProcessing(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(
    `UPDATE sync_outbox SET status = 'processing' WHERE id = ?`,
    [id]
  );
}

/**
 * Removes an outbox entry completely after successful sync.
 */
export async function resolveOutboxEntry(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(
    `DELETE FROM sync_outbox WHERE id = ?`,
    [id]
  );
}

/**
 * Marks an outbox entry as failed and increments the retry count.
 */
export async function failOutboxEntry(db: SQLiteDatabase, id: string, errorMsg: string): Promise<void> {
  await db.runAsync(
    `UPDATE sync_outbox 
     SET status = 'pending', retry_count = retry_count + 1, error_info = ? 
     WHERE id = ?`,
    [errorMsg, id]
  );
}
