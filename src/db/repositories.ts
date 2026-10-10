import { getDatabase, withTransaction } from './index';
import { AttendanceRecord, TimetableEntry, AppSettings, Subject } from '../types';
import { enqueueOutboxOperation } from './outbox';
import { v4 as uuidv4 } from 'uuid';

// Settings Repository
export async function getSettings(): Promise<AppSettings | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM user_preferences WHERE key = '@tracker_settings'`
  );
  return row ? JSON.parse(row.value) : null;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await withTransaction(async (tx: any) => {
    await tx.runAsync(
      `INSERT OR REPLACE INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)`,
      ['@tracker_settings', JSON.stringify(settings), new Date().toISOString()]
    );
    await enqueueOutboxOperation(tx, 'UPDATE', 'user_preferences', '@tracker_settings', settings);
  });
}

// Timetable Repository
export async function getTimetable(): Promise<TimetableEntry[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(`
    SELECT t.id, t.day_of_week, t.start_time, t.end_time, t.subject_id, t.component, t.is_attendance_bearing, t.weight, t.batch_constraint, s.name as display_name
    FROM timetable_rules t
    LEFT JOIN subjects s ON t.subject_id = s.id
  `);
  
  return rows.map(r => ({
    id: r.id,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time,
    endTime: r.end_time,
    subjectId: r.subject_id,
    component: r.component,
    isAttendanceBearing: r.is_attendance_bearing === 1,
    weight: r.weight,
    batchConstraint: r.batch_constraint || undefined,
    displayName: r.display_name
  }));
}

export async function saveTimetable(entries: TimetableEntry[]): Promise<void> {
  await withTransaction(async (tx: any) => {
    const now = new Date().toISOString();
    
    // For simplicity in this phase, since Timetable is managed as a whole in the legacy UI,
    // we clear existing rules for the active semester and recreate them.
    const semester = await tx.getFirstAsync(`SELECT id FROM semesters WHERE is_active = 1`);
    const semesterId = semester ? semester.id : 'unknown';

    await tx.runAsync(`DELETE FROM timetable_rules WHERE semester_id = ?`, [semesterId]);

    for (const entry of entries) {
      // Ensure subject exists for this entry
      await tx.runAsync(
        `INSERT OR IGNORE INTO subjects (id, semester_id, name, has_theory, has_practical, created_at, updated_at) 
         VALUES (?, ?, ?, 0, 0, ?, ?)`,
        [entry.subjectId, semesterId, entry.displayName || entry.subjectId, now, now]
      );

      await tx.runAsync(
        `INSERT INTO timetable_rules (id, semester_id, subject_id, day_of_week, start_time, end_time, component, is_attendance_bearing, weight, batch_constraint, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.id, semesterId, entry.subjectId, entry.dayOfWeek, entry.startTime, entry.endTime, 
          entry.component, entry.isAttendanceBearing ? 1 : 0, entry.weight, entry.batchConstraint || null, now, now
        ]
      );
      await enqueueOutboxOperation(tx, 'INSERT', 'timetable_rules', entry.id, entry);
    }
  });
}

// Attendance Repository
export async function getAttendanceRecords(): Promise<AttendanceRecord[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(`
    SELECT a.id, a.status, a.created_at, a.updated_at, c.subject_id, c.component, c.date, c.timetable_rule_id, c.weight
    FROM attendance_records a
    JOIN class_sessions c ON a.session_id = c.id
  `);

  return rows.map(r => ({
    id: r.id,
    subjectId: r.subject_id,
    component: r.component,
    date: r.date,
    timetableEntryId: r.timetable_rule_id,
    status: r.status,
    weight: r.weight,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

export async function addAttendanceRecord(record: AttendanceRecord): Promise<void> {
  await withTransaction(async (tx: any) => {
    const semester = await tx.getFirstAsync(`SELECT id FROM semesters WHERE is_active = 1`);
    const semesterId = semester ? semester.id : 'unknown';
    const sessionId = uuidv4();
    
    // Fallback times if rule is missing
    const rule = await tx.getFirstAsync(`SELECT start_time, end_time FROM timetable_rules WHERE id = ?`, [record.timetableEntryId]);
    const startTime = rule ? rule.start_time : '00:00';
    const endTime = rule ? rule.end_time : '01:00';

    await tx.runAsync(
      `INSERT OR IGNORE INTO subjects (id, semester_id, name, has_theory, has_practical, created_at, updated_at) 
       VALUES (?, ?, ?, 0, 0, ?, ?)`,
      [record.subjectId, semesterId, record.subjectId, record.createdAt, record.createdAt]
    );

    await tx.runAsync(
      `INSERT INTO class_sessions (id, semester_id, subject_id, timetable_rule_id, date, start_time, end_time, component, weight, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, semesterId, record.subjectId, record.timetableEntryId, record.date, startTime, endTime, record.component, record.weight, record.createdAt, record.updatedAt]
    );

    await tx.runAsync(
      `INSERT INTO attendance_records (id, session_id, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [record.id, sessionId, record.status, record.createdAt, record.updatedAt]
    );

    await enqueueOutboxOperation(tx, 'INSERT', 'attendance_records', record.id, record);
  });
}

export async function deleteAttendanceRecordDb(id: string): Promise<void> {
  await withTransaction(async (tx: any) => {
    // Due to ON DELETE CASCADE (or just manual cleanup), we find the session and delete it
    const row = await tx.getFirstAsync(`SELECT session_id FROM attendance_records WHERE id = ?`, [id]);
    if (row) {
      await tx.runAsync(`DELETE FROM attendance_records WHERE id = ?`, [id]);
      // Optional: Delete the class_session if it's no longer needed, but 'Pending' attendance means the session should probably stay if it's bound to a timetable rule?
      // In Tracker's legacy architecture, deleting a record removes it entirely. So we delete the session too if it was an ad-hoc or mapped one that we generated.
      await tx.runAsync(`DELETE FROM class_sessions WHERE id = ?`, [row.session_id]);
      
      await enqueueOutboxOperation(tx, 'DELETE', 'attendance_records', id);
    }
  });
}

export async function updateAttendanceRecordDb(id: string, record: AttendanceRecord): Promise<void> {
  await withTransaction(async (tx: any) => {
    await tx.runAsync(`UPDATE attendance_records SET status = ?, updated_at = ? WHERE id = ?`, 
      [record.status, record.updatedAt, id]);
      
    // Update class_sessions if weight/component changed (rare but possible in legacy edit)
    const row = await tx.getFirstAsync(`SELECT session_id FROM attendance_records WHERE id = ?`, [id]);
    if (row) {
      await tx.runAsync(
        `UPDATE class_sessions SET weight = ?, component = ?, updated_at = ? WHERE id = ?`,
        [record.weight, record.component, record.updatedAt, row.session_id]
      );
    }

    await enqueueOutboxOperation(tx, 'UPDATE', 'attendance_records', id, record);
  });
}

export async function restoreBackupData(
  records: AttendanceRecord[],
  timetable: TimetableEntry[],
  settings: AppSettings,
  exportedAt: string,
  habits?: any[],
  habitEntries?: any[]
): Promise<{ success: boolean; conflicts: string[] }> {
  return await withTransaction(async (tx: any) => {
    const now = new Date().toISOString();
    const conflicts: string[] = [];

    // Active semester for relations
    const semester = await tx.getFirstAsync(`SELECT id FROM semesters WHERE is_active = 1`);
    const semesterId = semester ? semester.id : 'unknown';

    // 1. Merge Settings
    // Since settings lack individual updated_at in backup, we just replace them or skip if local is newer than export
    // For simplicity, we just apply backup settings to avoid user configuration loss
    await tx.runAsync(
      `INSERT OR REPLACE INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)`,
      ['@tracker_settings', JSON.stringify(settings), now]
    );

    // 2. Merge Timetable
    // For timetable, we use stable IDs. If it exists, we update. If not, we insert.
    for (const entry of timetable) {
      // Ensure subject exists
      await tx.runAsync(
        `INSERT OR IGNORE INTO subjects (id, semester_id, name, has_theory, has_practical, created_at, updated_at) 
         VALUES (?, ?, ?, 0, 0, ?, ?)`,
        [entry.subjectId, semesterId, entry.displayName || entry.subjectId, now, now]
      );
      
      const existingRule = await tx.getFirstAsync(`SELECT id FROM timetable_rules WHERE id = ?`, [entry.id]);
      if (existingRule) {
        await tx.runAsync(
          `UPDATE timetable_rules SET 
             subject_id = ?, day_of_week = ?, start_time = ?, end_time = ?, component = ?, 
             is_attendance_bearing = ?, weight = ?, batch_constraint = ?, updated_at = ?
           WHERE id = ?`,
          [
            entry.subjectId, entry.dayOfWeek, entry.startTime, entry.endTime, entry.component,
            entry.isAttendanceBearing ? 1 : 0, entry.weight, entry.batchConstraint || null, now, entry.id
          ]
        );
      } else {
        await tx.runAsync(
          `INSERT INTO timetable_rules (id, semester_id, subject_id, day_of_week, start_time, end_time, component, is_attendance_bearing, weight, batch_constraint, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            entry.id, semesterId, entry.subjectId, entry.dayOfWeek, entry.startTime, entry.endTime, 
            entry.component, entry.isAttendanceBearing ? 1 : 0, entry.weight, entry.batchConstraint || null, now, now
          ]
        );
      }
    }

    // 3. Merge Attendance Records
    for (const record of records) {
      const existingAttendance = await tx.getFirstAsync(
        `SELECT a.id, a.status, a.updated_at, c.id as session_id 
         FROM attendance_records a 
         JOIN class_sessions c ON a.session_id = c.id 
         WHERE a.id = ?`, 
        [record.id]
      );

      if (existingAttendance) {
        // Compare updatedAt
        const localUpdated = new Date(existingAttendance.updated_at).getTime();
        const backupUpdated = new Date(record.updatedAt).getTime();

        if (backupUpdated > localUpdated) {
          // Backup is newer, overwrite local
          await tx.runAsync(`UPDATE attendance_records SET status = ?, updated_at = ? WHERE id = ?`, 
            [record.status, record.updatedAt, record.id]);
        } else if (localUpdated > backupUpdated && existingAttendance.status !== record.status) {
          // Conflict: Local is newer than backup, and they differ. Keep local, log conflict.
          conflicts.push(`Record ${record.id} (${record.date}): Kept local changes.`);
        }
        // If equal, no action needed.
      } else {
        // Insert new record
        const sessionId = uuidv4();
        
        const rule = timetable.find(t => t.id === record.timetableEntryId);
        const startTime = rule ? rule.startTime : '00:00';
        const endTime = rule ? rule.endTime : '01:00';

        await tx.runAsync(
          `INSERT OR IGNORE INTO subjects (id, semester_id, name, has_theory, has_practical, created_at, updated_at) 
           VALUES (?, ?, ?, 0, 0, ?, ?)`,
          [record.subjectId, semesterId, record.subjectId, now, now]
        );

        await tx.runAsync(
          `INSERT INTO class_sessions (id, semester_id, subject_id, timetable_rule_id, date, start_time, end_time, component, weight, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sessionId, semesterId, record.subjectId, record.timetableEntryId, record.date, startTime, endTime, record.component, record.weight, record.createdAt, record.updatedAt]
        );

        await tx.runAsync(
          `INSERT INTO attendance_records (id, session_id, status, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?)`,
          [record.id, sessionId, record.status, record.createdAt, record.updatedAt]
        );
      }
    }

    if (habits && habits.length > 0) {
      for (const h of habits) {
        const tombstone = await tx.getFirstAsync(`SELECT deleted_at FROM deleted_records WHERE id = ? AND table_name = 'habits'`, [h.id]) as { deleted_at: string } | null;
        if (tombstone && new Date(tombstone.deleted_at).getTime() > new Date(h.updated_at).getTime()) {
          conflicts.push(`Habit ${h.id}: Ignored due to newer local deletion.`);
          continue;
        }
        await tx.runAsync(
          `INSERT OR IGNORE INTO habits (id, name, icon, color, frequency_type, target_count, start_date, reminder_time, reminder_enabled, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [h.id, h.name, h.icon || null, h.color || null, h.frequency_type, h.target_count, h.start_date, h.reminder_time || null, h.reminder_enabled ? 1 : 0, h.created_at, h.updated_at]
        );
      }
    }

    if (habitEntries && habitEntries.length > 0) {
      for (const e of habitEntries) {
        const tombstone = await tx.getFirstAsync(`SELECT deleted_at FROM deleted_records WHERE id = ? AND table_name = 'habit_entries'`, [e.id]) as { deleted_at: string } | null;
        if (tombstone && new Date(tombstone.deleted_at).getTime() > new Date(e.updated_at).getTime()) {
          continue;
        }
        await tx.runAsync(
          `INSERT OR IGNORE INTO habit_entries (id, habit_id, date, count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [e.id, e.habit_id, e.date, e.count, e.created_at, e.updated_at]
        );
      }
    }

    // Return status
    return { success: true, conflicts };
  });
}

