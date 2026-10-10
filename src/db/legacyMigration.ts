import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, withTransaction } from './index';
import { SQLiteDatabase } from 'expo-sqlite';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { MOCK_SUBJECTS } from '../data/mock';
import { AttendanceRecord, TimetableEntry, AppSettings } from '../types';

const ATTENDANCE_KEY = '@tracker_attendance_records';
const SETTINGS_KEY = '@tracker_settings';
const TIMETABLE_KEY = '@tracker_timetable';
const SAFETY_SNAPSHOT_KEY = '@tracker_safety_snapshot';

export async function migrateLegacyDataIfNeeded(db: SQLiteDatabase) {
  // Check if migration is already complete
  const result = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM local_metadata WHERE key = 'legacy_migration_status'`
  );
  
  if (result && result.value === 'completed') {
    return;
  }

  console.log('[Migration] Starting legacy AsyncStorage to SQLite migration...');

  // 1. Read legacy data
  const rawAttendance = await AsyncStorage.getItem(ATTENDANCE_KEY);
  const rawSettings = await AsyncStorage.getItem(SETTINGS_KEY);
  const rawTimetable = await AsyncStorage.getItem(TIMETABLE_KEY);

  // If there's absolutely no data, we still mark migration as complete to avoid running it again.
  if (!rawAttendance && !rawSettings && !rawTimetable) {
    console.log('[Migration] No legacy data found. Marking as completed.');
    await db.runAsync(`INSERT OR REPLACE INTO local_metadata (key, value) VALUES ('legacy_migration_status', 'completed')`);
    return;
  }

  const attendance: AttendanceRecord[] = rawAttendance ? JSON.parse(rawAttendance) : [];
  const settings: AppSettings | null = rawSettings ? JSON.parse(rawSettings) : null;
  const timetable: TimetableEntry[] = rawTimetable ? JSON.parse(rawTimetable) : [];

  // 2. Take a safety snapshot in AsyncStorage just in case
  const snapshot = {
    appId: 'tracker',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      attendanceRecords: attendance,
      settings: settings || { studentBatch: 'All', targetPercentage: 0.75 },
      timetable,
    }
  };
  await AsyncStorage.setItem(SAFETY_SNAPSHOT_KEY + '_migration', JSON.stringify(snapshot));

  // 3. Migrate data within a SQLite transaction
  await db.withExclusiveTransactionAsync(async (txn) => {
    // We need a default semester to attach academic data to.
    const semesterId = uuidv4();
    const now = new Date().toISOString();
    
    await txn.runAsync(
      `INSERT INTO semesters (id, name, start_date, end_date, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [semesterId, 'Legacy Semester', '2023-01-01', '2030-12-31', now, now]
    );

    // Insert Subjects (using MOCK_SUBJECTS as legacy didn't store subjects in AsyncStorage usually)
    for (const sub of MOCK_SUBJECTS) {
      await txn.runAsync(
        `INSERT INTO subjects (id, semester_id, name, has_theory, has_practical, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [sub.id, semesterId, sub.name, sub.hasTheory ? 1 : 0, sub.hasPractical ? 1 : 0, now, now]
      );
    }

    // Insert Timetable Rules
    for (const entry of timetable) {
      // Avoid foreign key failure if subjectId doesn't exist (e.g. sports, library)
      const isMockSubject = MOCK_SUBJECTS.some(s => s.id === entry.subjectId);
      let targetSubjectId = entry.subjectId;
      
      if (!isMockSubject) {
        // Create an ad-hoc subject for sports/library
        await txn.runAsync(
          `INSERT OR IGNORE INTO subjects (id, semester_id, name, has_theory, has_practical, created_at, updated_at) 
           VALUES (?, ?, ?, 0, 0, ?, ?)`,
          [targetSubjectId, semesterId, entry.displayName || targetSubjectId, now, now]
        );
      }

      await txn.runAsync(
        `INSERT INTO timetable_rules (id, semester_id, subject_id, day_of_week, start_time, end_time, component, is_attendance_bearing, weight, batch_constraint, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.id, 
          semesterId, 
          targetSubjectId, 
          entry.dayOfWeek, 
          entry.startTime, 
          entry.endTime, 
          entry.component, 
          entry.isAttendanceBearing ? 1 : 0, 
          entry.weight, 
          entry.batchConstraint || null, 
          now, 
          now
        ]
      );
    }

    // Insert Attendance Records and their wrapping Class Sessions
    for (const record of attendance) {
      const sessionId = uuidv4(); // Generate a session wrapping the attendance
      
      // Look up timetable rule to fill start/end times if possible
      const rule = timetable.find(t => t.id === record.timetableEntryId);
      const startTime = rule ? rule.startTime : '00:00';
      const endTime = rule ? rule.endTime : '01:00';

      // Ensure subject exists
      const isMockSubject = MOCK_SUBJECTS.some(s => s.id === record.subjectId);
      let targetSubjectId = record.subjectId;
      if (!isMockSubject) {
        await txn.runAsync(
          `INSERT OR IGNORE INTO subjects (id, semester_id, name, has_theory, has_practical, created_at, updated_at) 
           VALUES (?, ?, ?, 0, 0, ?, ?)`,
          [targetSubjectId, semesterId, targetSubjectId, now, now]
        );
      }

      await txn.runAsync(
        `INSERT INTO class_sessions (id, semester_id, subject_id, timetable_rule_id, date, start_time, end_time, component, weight, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId, 
          semesterId, 
          targetSubjectId, 
          record.timetableEntryId, 
          record.date, 
          startTime, 
          endTime, 
          record.component, 
          record.weight, 
          record.createdAt || now, 
          record.updatedAt || now
        ]
      );

      await txn.runAsync(
        `INSERT INTO attendance_records (id, session_id, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          record.id, 
          sessionId, 
          record.status, 
          record.createdAt || now, 
          record.updatedAt || now
        ]
      );
    }

    // Insert Settings
    if (settings) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)`,
        ['app_settings', JSON.stringify(settings), now]
      );
    }

    // Mark completed
    await txn.runAsync(`INSERT OR REPLACE INTO local_metadata (key, value) VALUES ('legacy_migration_status', 'completed')`);
  });

  console.log('[Migration] Legacy migration completed safely.');
}
