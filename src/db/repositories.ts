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
    
    let semester = await tx.getFirstAsync(`SELECT id FROM semesters WHERE is_active = 1`);
    let semesterId = semester ? semester.id : null;
    if (!semesterId) {
      semesterId = uuidv4();
      await tx.runAsync(
        `INSERT INTO semesters (id, name, start_date, end_date, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        [semesterId, 'Semester 1', now, now, now, now]
      );
      await enqueueOutboxOperation(tx, 'INSERT', 'semesters', semesterId, {
        id: semesterId,
        name: 'Semester 1',
        start_date: now,
        end_date: now,
        is_active: true,
        created_at: now,
        updated_at: now
      });
    }

    await tx.runAsync(`DELETE FROM timetable_rules WHERE semester_id = ?`, [semesterId]);

    for (const entry of entries) {
      // Ensure subject exists for this entry
      const existingSub = await tx.getFirstAsync(`SELECT id FROM subjects WHERE id = ?`, [entry.subjectId]);
      if (!existingSub) {
        await tx.runAsync(
          `INSERT INTO subjects (id, semester_id, name, has_theory, has_practical, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [entry.subjectId, semesterId, entry.displayName || entry.subjectId, entry.component === 'theory' ? 1 : 0, entry.component === 'practical' ? 1 : 0, now, now]
        );
        await enqueueOutboxOperation(tx, 'INSERT', 'subjects', entry.subjectId, {
          id: entry.subjectId,
          semester_id: semesterId,
          name: entry.displayName || entry.subjectId,
          has_theory: entry.component === 'theory',
          has_practical: entry.component === 'practical',
          created_at: now,
          updated_at: now
        });
      }

      await tx.runAsync(
        `INSERT INTO timetable_rules (id, semester_id, subject_id, day_of_week, start_time, end_time, component, is_attendance_bearing, weight, batch_constraint, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.id, semesterId, entry.subjectId, entry.dayOfWeek, entry.startTime, entry.endTime, 
          entry.component, entry.isAttendanceBearing ? 1 : 0, entry.weight, entry.batchConstraint || null, now, now
        ]
      );
      await enqueueOutboxOperation(tx, 'INSERT', 'timetable_rules', entry.id, {
        id: entry.id,
        semester_id: semesterId,
        subject_id: entry.subjectId,
        day_of_week: entry.dayOfWeek,
        start_time: entry.startTime,
        end_time: entry.endTime,
        component: entry.component,
        is_attendance_bearing: entry.isAttendanceBearing,
        weight: entry.weight,
        batch_constraint: entry.batchConstraint || null,
        created_at: now,
        updated_at: now
      });
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
    let semester = await tx.getFirstAsync(`SELECT id FROM semesters WHERE is_active = 1`);
    let semesterId = semester ? semester.id : null;
    const now = new Date().toISOString();

    if (!semesterId) {
      semesterId = uuidv4();
      await tx.runAsync(
        `INSERT INTO semesters (id, name, start_date, end_date, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        [semesterId, 'Semester 1', now, now, now, now]
      );
      await enqueueOutboxOperation(tx, 'INSERT', 'semesters', semesterId, {
        id: semesterId,
        name: 'Semester 1',
        start_date: now,
        end_date: now,
        is_active: true,
        created_at: now,
        updated_at: now
      });
    }

    const sessionId = uuidv4();
    
    // Fallback times if rule is missing
    const rule = await tx.getFirstAsync(`SELECT start_time, end_time FROM timetable_rules WHERE id = ?`, [record.timetableEntryId]);
    const startTime = rule ? rule.start_time : '00:00';
    const endTime = rule ? rule.end_time : '01:00';

    // Ensure subject exists in SQLite and outbox
    const existingSub = await tx.getFirstAsync(`SELECT id FROM subjects WHERE id = ?`, [record.subjectId]);
    if (!existingSub) {
      await tx.runAsync(
        `INSERT INTO subjects (id, semester_id, name, has_theory, has_practical, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [record.subjectId, semesterId, record.subjectId, record.component === 'theory' ? 1 : 0, record.component === 'practical' ? 1 : 0, record.createdAt, record.createdAt]
      );
      await enqueueOutboxOperation(tx, 'INSERT', 'subjects', record.subjectId, {
        id: record.subjectId,
        semester_id: semesterId,
        name: record.subjectId,
        has_theory: record.component === 'theory',
        has_practical: record.component === 'practical',
        created_at: record.createdAt,
        updated_at: record.createdAt
      });
    }

    // Insert and enqueue class_sessions
    await tx.runAsync(
      `INSERT INTO class_sessions (id, semester_id, subject_id, timetable_rule_id, date, start_time, end_time, component, weight, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, semesterId, record.subjectId, record.timetableEntryId, record.date, startTime, endTime, record.component, record.weight, record.createdAt, record.updatedAt]
    );
    await enqueueOutboxOperation(tx, 'INSERT', 'class_sessions', sessionId, {
      id: sessionId,
      semester_id: semesterId,
      subject_id: record.subjectId,
      timetable_rule_id: record.timetableEntryId,
      date: record.date,
      start_time: startTime,
      end_time: endTime,
      component: record.component,
      weight: record.weight,
      created_at: record.createdAt,
      updated_at: record.updatedAt
    });

    // Insert and enqueue attendance_records
    await tx.runAsync(
      `INSERT INTO attendance_records (id, session_id, status, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [record.id, sessionId, record.status, record.createdAt, record.updatedAt]
    );
    await enqueueOutboxOperation(tx, 'INSERT', 'attendance_records', record.id, {
      id: record.id,
      session_id: sessionId,
      status: record.status,
      created_at: record.createdAt,
      updated_at: record.updatedAt
    });
  });
}

export async function deleteAttendanceRecordDb(id: string): Promise<void> {
  await withTransaction(async (tx: any) => {
    const row = await tx.getFirstAsync(`SELECT session_id FROM attendance_records WHERE id = ?`, [id]);
    if (row) {
      await tx.runAsync(`DELETE FROM attendance_records WHERE id = ?`, [id]);
      await tx.runAsync(`DELETE FROM class_sessions WHERE id = ?`, [row.session_id]);
      
      await enqueueOutboxOperation(tx, 'DELETE', 'attendance_records', id);
      await enqueueOutboxOperation(tx, 'DELETE', 'class_sessions', row.session_id);
    }
  });
}

export async function updateAttendanceRecordDb(id: string, record: AttendanceRecord): Promise<void> {
  await withTransaction(async (tx: any) => {
    await tx.runAsync(`UPDATE attendance_records SET status = ?, updated_at = ? WHERE id = ?`, 
      [record.status, record.updatedAt, id]);
      
    const row = await tx.getFirstAsync(`SELECT session_id FROM attendance_records WHERE id = ?`, [id]);
    if (row) {
      await tx.runAsync(
        `UPDATE class_sessions SET weight = ?, component = ?, updated_at = ? WHERE id = ?`,
        [record.weight, record.component, record.updatedAt, row.session_id]
      );
      await enqueueOutboxOperation(tx, 'UPDATE', 'class_sessions', row.session_id, {
        id: row.session_id,
        weight: record.weight,
        component: record.component,
        updated_at: record.updatedAt
      });
    }

    await enqueueOutboxOperation(tx, 'UPDATE', 'attendance_records', id, {
      id,
      status: record.status,
      updated_at: record.updatedAt
    });
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

// ==========================================
// Semesters Repository
// ==========================================
export async function getSemesters(): Promise<any[]> {
  const db = await getDatabase();
  return await db.getAllAsync<any>(`SELECT * FROM semesters ORDER BY created_at DESC`);
}

export async function getActiveSemester(): Promise<any | null> {
  const db = await getDatabase();
  return await db.getFirstAsync<any>(`SELECT * FROM semesters WHERE is_active = 1`);
}

export async function setActiveSemester(semesterId: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await withTransaction(async (tx: any) => {
    await tx.runAsync(`UPDATE semesters SET is_active = 0`);
    await tx.runAsync(`UPDATE semesters SET is_active = 1, updated_at = ? WHERE id = ?`, [now, semesterId]);
    await enqueueOutboxOperation(tx, 'UPDATE', 'semesters', semesterId, {
      id: semesterId,
      is_active: true,
      updated_at: now
    });
  });
}

export async function createSemester(name: string, startDate: string, endDate?: string): Promise<string> {
  const db = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();
  const end = endDate || startDate;
  await withTransaction(async (tx: any) => {
    await tx.runAsync(`UPDATE semesters SET is_active = 0`);
    await tx.runAsync(
      `INSERT INTO semesters (id, name, start_date, end_date, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [id, name, startDate, end, now, now]
    );
    await enqueueOutboxOperation(tx, 'INSERT', 'semesters', id, {
      id,
      name,
      start_date: startDate,
      end_date: end,
      is_active: true,
      created_at: now,
      updated_at: now
    });
  });
  return id;
}

export async function ensureActiveSemester(name = 'Semester 1'): Promise<string> {
  const db = await getDatabase();
  const existing = await db.getFirstAsync<any>(`SELECT id FROM semesters WHERE is_active = 1`);
  if (existing?.id) return existing.id;

  const id = uuidv4();
  const now = new Date().toISOString();
  await withTransaction(async (tx: any) => {
    await tx.runAsync(
      `INSERT INTO semesters (id, name, start_date, end_date, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [id, name, now, now, now, now]
    );
    await enqueueOutboxOperation(tx, 'INSERT', 'semesters', id, {
      id,
      name,
      start_date: now,
      end_date: now,
      is_active: true,
      created_at: now,
      updated_at: now
    });
  });
  return id;
}

// ==========================================
// Subjects Repository
// ==========================================
export async function getSubjects(semesterId?: string): Promise<Subject[]> {
  const db = await getDatabase();
  let rows: any[];
  if (semesterId) {
    rows = await db.getAllAsync<any>(`SELECT * FROM subjects WHERE semester_id = ? ORDER BY name ASC`, [semesterId]);
  } else {
    // Check active semester first
    const activeSem = await db.getFirstAsync<any>(`SELECT id FROM semesters WHERE is_active = 1`);
    if (activeSem?.id) {
      rows = await db.getAllAsync<any>(`SELECT * FROM subjects WHERE semester_id = ? ORDER BY name ASC`, [activeSem.id]);
    } else {
      rows = await db.getAllAsync<any>(`SELECT * FROM subjects ORDER BY name ASC`);
    }
  }

  return rows.map(r => ({
    id: r.id,
    name: r.name,
    hasTheory: r.has_theory === 1,
    hasPractical: r.has_practical === 1,
  }));
}

export async function getSubjectById(id: string): Promise<Subject | null> {
  const db = await getDatabase();
  const r = await db.getFirstAsync<any>(`SELECT * FROM subjects WHERE id = ?`, [id]);
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    hasTheory: r.has_theory === 1,
    hasPractical: r.has_practical === 1,
  };
}

export async function saveSubject(subject: Subject): Promise<void> {
  await withTransaction(async (tx: any) => {
    let semester = await tx.getFirstAsync(`SELECT id FROM semesters WHERE is_active = 1`);
    let semesterId = semester?.id;
    const now = new Date().toISOString();
    if (!semesterId) {
      semesterId = uuidv4();
      await tx.runAsync(
        `INSERT INTO semesters (id, name, start_date, end_date, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        [semesterId, 'Semester 1', now, now, now, now]
      );
      await enqueueOutboxOperation(tx, 'INSERT', 'semesters', semesterId, {
        id: semesterId,
        name: 'Semester 1',
        start_date: now,
        end_date: now,
        is_active: true,
        created_at: now,
        updated_at: now
      });
    }

    await tx.runAsync(
      `INSERT INTO subjects (id, semester_id, name, has_theory, has_practical, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, has_theory = excluded.has_theory, has_practical = excluded.has_practical, updated_at = excluded.updated_at`,
      [subject.id, semesterId, subject.name, subject.hasTheory ? 1 : 0, subject.hasPractical ? 1 : 0, now, now]
    );

    await enqueueOutboxOperation(tx, 'INSERT', 'subjects', subject.id, {
      id: subject.id,
      semester_id: semesterId,
      name: subject.name,
      has_theory: subject.hasTheory,
      has_practical: subject.hasPractical,
      created_at: now,
      updated_at: now
    });
  });
}

export async function deleteSubject(id: string): Promise<void> {
  await withTransaction(async (tx: any) => {
    await tx.runAsync(`DELETE FROM subjects WHERE id = ?`, [id]);
    await enqueueOutboxOperation(tx, 'DELETE', 'subjects', id);
  });
}

// ==========================================
// Holidays Repository
// ==========================================
export async function getHolidays(semesterId?: string): Promise<{ id: string; date: string; name?: string }[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    semesterId
      ? `SELECT id, date, name FROM holidays WHERE semester_id = ? ORDER BY date ASC`
      : `SELECT id, date, name FROM holidays ORDER BY date ASC`,
    semesterId ? [semesterId] : []
  );
  return rows.map(r => ({ id: r.id, date: r.date, name: r.name || undefined }));
}

export async function addHoliday(date: string, name?: string): Promise<void> {
  await withTransaction(async (tx: any) => {
    let semester = await tx.getFirstAsync(`SELECT id FROM semesters WHERE is_active = 1`);
    let semesterId = semester?.id;
    const now = new Date().toISOString();
    if (!semesterId) {
      semesterId = uuidv4();
      await tx.runAsync(
        `INSERT INTO semesters (id, name, start_date, end_date, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        [semesterId, 'Semester 1', now, now, now, now]
      );
      await enqueueOutboxOperation(tx, 'INSERT', 'semesters', semesterId, {
        id: semesterId,
        name: 'Semester 1',
        start_date: now,
        end_date: now,
        is_active: true,
        created_at: now,
        updated_at: now
      });
    }

    const id = uuidv4();
    await tx.runAsync(
      `INSERT INTO holidays (id, semester_id, date, name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
      [id, semesterId, date, name || 'Holiday', now, now]
    );

    await enqueueOutboxOperation(tx, 'INSERT', 'holidays', id, {
      id,
      semester_id: semesterId,
      date,
      name: name || 'Holiday',
      created_at: now,
      updated_at: now
    });
  });
}

export async function deleteHoliday(date: string): Promise<void> {
  await withTransaction(async (tx: any) => {
    const row: any = await tx.getFirstAsync(`SELECT id FROM holidays WHERE date = ?`, [date]);
    if (row) {
      await tx.runAsync(`DELETE FROM holidays WHERE id = ?`, [row.id]);
      await enqueueOutboxOperation(tx, 'DELETE', 'holidays', row.id);
    }
  });
}

export async function isDateHoliday(date: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(`SELECT id FROM holidays WHERE date = ?`, [date]);
  return !!row;
}

// ==========================================
// Baselines Repository
// ==========================================
export async function getAttendanceBaselines(subjectId?: string): Promise<any[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    subjectId
      ? `SELECT * FROM attendance_baselines WHERE subject_id = ?`
      : `SELECT * FROM attendance_baselines`,
    subjectId ? [subjectId] : []
  );
  return rows.map(r => ({
    id: r.id,
    subjectId: r.subject_id,
    component: r.component,
    attendedWeight: r.attended_weight,
    conductedWeight: r.conducted_weight,
  }));
}

export async function saveAttendanceBaseline(baseline: {
  subjectId: string;
  component: string;
  attendedWeight: number;
  conductedWeight: number;
}): Promise<void> {
  await withTransaction(async (tx: any) => {
    const now = new Date().toISOString();
    const id = uuidv4();
    await tx.runAsync(
      `INSERT INTO attendance_baselines (id, subject_id, component, attended_weight, conducted_weight, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(subject_id, component) DO UPDATE SET attended_weight = excluded.attended_weight, conducted_weight = excluded.conducted_weight, updated_at = excluded.updated_at`,
      [id, baseline.subjectId, baseline.component, baseline.attendedWeight, baseline.conductedWeight, now, now]
    );
    await enqueueOutboxOperation(tx, 'INSERT', 'attendance_baselines', id, {
      id,
      subject_id: baseline.subjectId,
      component: baseline.component,
      attended: baseline.attendedWeight,
      conducted: baseline.conductedWeight,
      created_at: now,
      updated_at: now
    });
  });
}


