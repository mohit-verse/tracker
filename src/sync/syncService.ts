import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getDatabase } from '../db';
import { OutboxEntry, OutboxStatus } from '../db/outbox';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

let isSyncing = false;

function cleanPayloadForSupabase(entityType: string, row: any): any {
  if (!row) return row;
  const clean = { ...row };
  delete clean.sync_status;
  delete clean.sync_revision;

  if (entityType === 'semesters') {
    if ('is_active' in clean) clean.is_active = Boolean(clean.is_active);
  } else if (entityType === 'subjects') {
    if ('has_theory' in clean) clean.has_theory = Boolean(clean.has_theory);
    if ('has_practical' in clean) clean.has_practical = Boolean(clean.has_practical);
    delete clean.code;
    delete clean.color;
    delete clean.target_percentage;
  } else if (entityType === 'timetable_rules') {
    if ('is_attendance_bearing' in clean) clean.is_attendance_bearing = Boolean(clean.is_attendance_bearing);
  } else if (entityType === 'habits') {
    if ('reminder_enabled' in clean) clean.reminder_enabled = Boolean(clean.reminder_enabled);
  } else if (entityType === 'attendance_baselines') {
    if ('attended_weight' in clean && !('attended' in clean)) {
      clean.attended = clean.attended_weight;
    }
    if ('conducted_weight' in clean && !('conducted' in clean)) {
      clean.conducted = clean.conducted_weight;
    }
    delete clean.attended_weight;
    delete clean.conducted_weight;
  }
  return clean;
}

export async function processOutbox(): Promise<void> {
  if (isSyncing) return;
  if (!isSupabaseConfigured) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn('[Sync] Cannot process outbox: No authenticated session.');
    return;
  }

  isSyncing = true;
  const db = await getDatabase();
  const workerId = uuidv4();

  try {
    const leaseThreshold = new Date(Date.now() - 5 * 60000).toISOString(); // 5 min
    // Reclaim stale processing operations from previous app crashes or deadlocks
    // Only reclaim if the claim is demonstrably stale.
    await db.runAsync(`UPDATE sync_outbox SET status = 'pending' WHERE status = 'processing' AND claimed_at < ?`, [leaseThreshold]);

    const now = new Date().toISOString();
    // Claim pending operations atomically with a worker fencing token
    await db.runAsync(
      `UPDATE sync_outbox SET status = 'processing', claimed_at = ?, claimed_by = ? WHERE status = 'pending' OR (status = 'failed' AND retry_count < 5)`,
      [now, workerId]
    );
    
    const operations = await db.getAllAsync<OutboxEntry>(`SELECT * FROM sync_outbox WHERE status = 'processing' AND claimed_by = ? ORDER BY created_at ASC`, [workerId]);

    for (const op of operations) {
      let success = false;
      let errorInfo = null;

      try {
        if (op.operation_type === 'INSERT' || op.operation_type === 'UPDATE') {
          if (op.entity_type === 'system' && op.entity_id === 'restore') {
            throw new Error('full_restore semantics not yet supported by cloud sync.');
          }

          // Fetch the latest state directly from SQLite
          let row: any = null;
          if (op.entity_type === 'user_preferences') {
            row = await db.getFirstAsync(`SELECT * FROM user_preferences WHERE key = ?`, [op.entity_id]);
          } else {
            row = await db.getFirstAsync(`SELECT * FROM ${op.entity_type} WHERE id = ?`, [op.entity_id]);
          }

          if (!row) {
            // The row was deleted locally before pushing. 
            const tombstonePayload = { 
              id: op.entity_id, 
              table_name: op.entity_type,
              user_id: session.user.id,
              deleted_at: new Date().toISOString()
            };
            const { error: tombstoneError } = await supabase.rpc('sync_upsert', {
              p_table_name: 'deleted_records',
              p_payload: tombstonePayload
            });

            if (tombstoneError) {
              const { error: directTombError } = await supabase.from('deleted_records').upsert(tombstonePayload);
              if (directTombError) throw directTombError;
            }
            success = true; 
          } else {
            const cleanRow = cleanPayloadForSupabase(op.entity_type, row);
            if (session?.user?.id) {
              cleanRow.user_id = session.user.id;
            }
            const { data, error } = await supabase.rpc('sync_upsert', {
              p_table_name: op.entity_type,
              p_payload: cleanRow
            });

            if (error) {
              // Direct table upsert fallback when RPC is unavailable
              const { error: directError } = await supabase.from(op.entity_type).upsert(cleanRow);
              if (directError) throw directError;
              success = true;
            } else if (data?.status === 'conflict') {
              // Server is newer. 
              // Reconcile locally immediately!
              const serverRow = data.data;
              if (serverRow) {
                if (serverRow.is_deleted) {
                  const idCol = op.entity_type === 'user_preferences' ? 'key' : 'id';
                  await db.runAsync(`DELETE FROM ${op.entity_type} WHERE ${idCol} = ?`, [serverRow.id]);
                } else {
                  const idCol = op.entity_type === 'user_preferences' ? 'key' : 'id';
                  const columns = Object.keys(serverRow).filter(k => k !== 'user_id');
                  const placeholders = columns.map(() => '?').join(', ');
                  const setClause = columns.map(c => `${c} = excluded.${c}`).join(', ');
                  const values = columns.map(c => serverRow[c]);

                  await db.runAsync(
                    `INSERT INTO ${op.entity_type} (${columns.join(', ')}) VALUES (${placeholders}) 
                     ON CONFLICT(${idCol}) DO UPDATE SET ${setClause}`,
                    values
                  );
                }
              }
              success = true;
            } else {
              success = true;
            }
          }
        } else if (op.operation_type === 'DELETE') {
          // Send tombstone
          const tombstonePayload = { id: op.entity_id, table_name: op.entity_type };
          const { error: tombstoneError } = await supabase.rpc('sync_upsert', {
            p_table_name: 'deleted_records',
            p_payload: tombstonePayload
          });

          if (tombstoneError) {
            await supabase.from('deleted_records').upsert(tombstonePayload);
          }

          // Delete actual record
          const { error: deleteError } = await supabase
            .from(op.entity_type)
            .delete()
            .eq(op.entity_type === 'user_preferences' ? 'key' : 'id', op.entity_id);
            
          if (deleteError) throw deleteError;
          success = true;
        }

      } catch (err: any) {
        success = false;
        errorInfo = err.message || JSON.stringify(err);
      }

      // Verify lease is still held by this worker
      const currentLease = await db.getFirstAsync<{claimed_by: string | null}>(`SELECT claimed_by FROM sync_outbox WHERE id = ?`, [op.id]);
      if (!currentLease || currentLease.claimed_by !== workerId) {
        console.warn(`[Sync] Lease lost for operation ${op.id}. Skipping local acknowledgement.`);
        continue;
      }

      if (success) {
        await db.runAsync(`DELETE FROM sync_outbox WHERE id = ? AND claimed_by = ?`, [op.id, workerId]);
      } else {
        await db.runAsync(
          `UPDATE sync_outbox SET status = 'failed', error_info = ?, retry_count = retry_count + 1 WHERE id = ? AND claimed_by = ?`,
          [errorInfo, op.id, workerId]
        );
      }
    }
  } catch (err) {
    console.error('[Sync] Fatal outbox processor error', err);
  } finally {
    isSyncing = false;
  }
}

export async function pullRemoteChanges(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const db = await getDatabase();
  const lastSyncResult = await db.getFirstAsync<{ value: string }>(`SELECT value FROM local_metadata WHERE key = 'last_pull_at'`);
  const lastPullAt = lastSyncResult ? lastSyncResult.value : '1970-01-01T00:00:00.000Z';
  const overlapPullAt = new Date(new Date(lastPullAt).getTime() - 60000).toISOString(); // 1 min overlap
  const pullTime = new Date().toISOString();

  // Define tables in FK safe order (parents first)
  const tables = [
    'semesters', 'week_off_days', 'subjects', 'attendance_baselines', 
    'timetable_rules', 'class_sessions', 'attendance_records', 'holidays',
    'user_preferences', 'habits', 'habit_entries'
  ];

  for (const table of tables) {
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      // Network call outside of SQLite transaction
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .gte('updated_at', overlapPullAt)
        .order('updated_at', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) {
        hasMore = false;
        continue;
      }

      if (data.length < pageSize) {
        hasMore = false;
      }

      // Apply the page locally in a single atomic transaction
      await db.withExclusiveTransactionAsync(async (tx) => {
        for (const row of data) {
          const idCol = table === 'user_preferences' ? 'key' : 'id';
          const idVal = row[idCol];

          // DO NOT overwrite if there is a pending local mutation!
          const pendingMutation = await tx.getFirstAsync(
            `SELECT id FROM sync_outbox WHERE entity_type = ? AND entity_id = ?`, 
            [table, idVal]
          );
          if (pendingMutation) {
            continue; // Skip this row. Local outbox wins, it will be resolved on push.
          }

          const localRow = await tx.getFirstAsync(`SELECT updated_at FROM ${table} WHERE ${idCol} = ?`, [idVal]) as { updated_at: string } | null;

          if (table === 'attendance_baselines') {
            if ('attended' in row && !('attended_weight' in row)) (row as any).attended_weight = (row as any).attended;
            if ('conducted' in row && !('conducted_weight' in row)) (row as any).conducted_weight = (row as any).conducted;
          }

          if (localRow) {
            const localUpdated = new Date(localRow.updated_at).getTime();
            const remoteUpdated = new Date(row.updated_at).getTime();

            if (remoteUpdated > localUpdated) {
              const columns = Object.keys(row).filter(k => k !== 'user_id');
              const placeholders = columns.map(() => '?').join(', ');
              const setClause = columns.map(c => `${c} = excluded.${c}`).join(', ');
              const values = columns.map(c => row[c]);

              await tx.runAsync(
                `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) 
                 ON CONFLICT(${idCol}) DO UPDATE SET ${setClause}`,
                values
              );
            }
          } else {
            const columns = Object.keys(row).filter(k => k !== 'user_id');
            const placeholders = columns.map(() => '?').join(', ');
            const values = columns.map(c => row[c]);
            await tx.runAsync(
              `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
              values
            );
          }
        }
      });
      
      page++;
    }
  }

  // Handle deletions
  let tombstonePage = 0;
  let hasMoreTombstones = true;
  while (hasMoreTombstones) {
    const { data: tombstones, error: tombstoneError } = await supabase
      .from('deleted_records')
      .select('*')
      .gte('deleted_at', overlapPullAt)
      .order('deleted_at', { ascending: true })
      .range(tombstonePage * 1000, (tombstonePage + 1) * 1000 - 1);
      
    if (tombstoneError) throw tombstoneError;
    if (!tombstones || tombstones.length === 0) {
      hasMoreTombstones = false;
      continue;
    }
    if (tombstones.length < 1000) hasMoreTombstones = false;

    await db.withExclusiveTransactionAsync(async (tx) => {
      for (const tomb of tombstones) {
        // Only delete if there isn't a pending outbox mutation recreating it
        const pending = await tx.getFirstAsync(`SELECT id FROM sync_outbox WHERE entity_type = ? AND entity_id = ? AND operation_type != 'DELETE'`, [tomb.table_name, tomb.id]);
        if (!pending) {
          const idCol = tomb.table_name === 'user_preferences' ? 'key' : 'id';
          await tx.runAsync(`DELETE FROM ${tomb.table_name} WHERE ${idCol} = ?`, [tomb.id]);
        }
      }
    });
    
    tombstonePage++;
  }

  // Update global cursor only after all pages process without throwing
  await db.runAsync(`INSERT OR REPLACE INTO local_metadata (key, value) VALUES ('last_pull_at', ?)`, [pullTime]);
}

let syncDebounceTimer: any = null;
export function triggerBackgroundSync() {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    processOutbox().catch(err => {
      console.warn('[Sync] Background sync notice:', err?.message || err);
    });
  }, 1000);
}

