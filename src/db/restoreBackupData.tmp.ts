// Inside repositories.ts, I will replace restoreBackupData
import { getDatabase, withTransaction } from './index';
import { AttendanceRecord, TimetableEntry, AppSettings } from '../types';
import { enqueueOutboxOperation } from './outbox';
import { v4 as uuidv4 } from 'uuid';

export async function restoreBackupData(
  records: AttendanceRecord[],
  timetable: TimetableEntry[],
  settings: AppSettings,
  exportedAt: string
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

    // Return status
    return { success: true, conflicts };
  });
}
