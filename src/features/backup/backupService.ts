import {
  AttendanceRecord,
  TimetableEntry,
  AppSettings,
  BackupDocument,
  BackupData,
  ValidationResult,
} from '../../types';

const CURRENT_SCHEMA_VERSION = 1;
const APP_ID = 'tracker';

/**
 * Creates a versioned backup document from current app state.
 * Does NOT modify any local data.
 */
import { Habit, HabitEntry } from '../../types';

export const createBackupDocument = (
  attendanceRecords: AttendanceRecord[],
  timetable: TimetableEntry[],
  settings: AppSettings,
  habits: Habit[] = [],
  habitEntries: HabitEntry[] = []
): BackupDocument => {
  return {
    appId: APP_ID,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      attendanceRecords,
      timetable,
      settings,
      habits,
      habitEntries
    },
  };
};

/**
 * Validates a backup document structurally and semantically.
 * Returns a ValidationResult with specific error descriptions.
 */
export const validateBackupDocument = (doc: unknown): ValidationResult => {
  const errors: string[] = [];

  // ---- structural checks ----
  if (!doc || typeof doc !== 'object') {
    return { valid: false, errors: ['Backup is not a valid object.'] };
  }

  const obj = doc as Record<string, unknown>;

  if (obj.appId !== APP_ID) {
    errors.push(`Invalid application identifier: expected "${APP_ID}", got "${obj.appId}".`);
  }

  if (typeof obj.schemaVersion !== 'number' || obj.schemaVersion < 1 || obj.schemaVersion > CURRENT_SCHEMA_VERSION) {
    errors.push(`Unsupported schema version: ${obj.schemaVersion}. This app supports version ${CURRENT_SCHEMA_VERSION}.`);
  }

  if (typeof obj.exportedAt !== 'string' || obj.exportedAt.length === 0) {
    errors.push('Missing or invalid exportedAt timestamp.');
  }

  if (!obj.data || typeof obj.data !== 'object') {
    errors.push('Missing data section.');
    return { valid: false, errors };
  }

  const data = obj.data as Record<string, unknown>;

  // ---- attendance records ----
  if (!Array.isArray(data.attendanceRecords)) {
    errors.push('Missing attendanceRecords array.');
  } else {
    for (let i = 0; i < data.attendanceRecords.length; i++) {
      const r = data.attendanceRecords[i];
      if (!r || typeof r !== 'object') {
        errors.push(`attendanceRecords[${i}]: not a valid object.`);
        continue;
      }
      const rec = r as Record<string, unknown>;
      if (typeof rec.id !== 'string' || rec.id.length === 0) {
        errors.push(`attendanceRecords[${i}]: missing or invalid id.`);
      }
      if (typeof rec.subjectId !== 'string') {
        errors.push(`attendanceRecords[${i}]: missing subjectId.`);
      }
      if (!['theory', 'practical', 'none'].includes(rec.component as string)) {
        errors.push(`attendanceRecords[${i}]: invalid component "${rec.component}".`);
      }
      if (typeof rec.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rec.date as string)) {
        errors.push(`attendanceRecords[${i}]: invalid date "${rec.date}".`);
      }
      if (!['present', 'absent'].includes(rec.status as string)) {
        errors.push(`attendanceRecords[${i}]: invalid status "${rec.status}".`);
      }
      if (typeof rec.weight !== 'number' || rec.weight < 0) {
        errors.push(`attendanceRecords[${i}]: invalid weight ${rec.weight}.`);
      }
    }
  }

  // ---- timetable entries ----
  if (!Array.isArray(data.timetable)) {
    errors.push('Missing timetable array.');
  } else {
    for (let i = 0; i < data.timetable.length; i++) {
      const e = data.timetable[i];
      if (!e || typeof e !== 'object') {
        errors.push(`timetable[${i}]: not a valid object.`);
        continue;
      }
      const entry = e as Record<string, unknown>;
      if (typeof entry.id !== 'string' || entry.id.length === 0) {
        errors.push(`timetable[${i}]: missing or invalid id.`);
      }
      if (typeof entry.dayOfWeek !== 'number' || entry.dayOfWeek < 0 || entry.dayOfWeek > 6) {
        errors.push(`timetable[${i}]: invalid dayOfWeek ${entry.dayOfWeek}.`);
      }
      if (typeof entry.startTime !== 'string') {
        errors.push(`timetable[${i}]: missing startTime.`);
      }
      if (typeof entry.endTime !== 'string') {
        errors.push(`timetable[${i}]: missing endTime.`);
      }
      if (typeof entry.subjectId !== 'string') {
        errors.push(`timetable[${i}]: missing subjectId.`);
      }
      if (!['theory', 'practical', 'none'].includes(entry.component as string)) {
        errors.push(`timetable[${i}]: invalid component "${entry.component}".`);
      }
      if (typeof entry.isAttendanceBearing !== 'boolean') {
        errors.push(`timetable[${i}]: missing isAttendanceBearing.`);
      }
      if (typeof entry.weight !== 'number' || entry.weight < 0) {
        errors.push(`timetable[${i}]: invalid weight ${entry.weight}.`);
      }
    }
  }

  // ---- settings ----
  if (!data.settings || typeof data.settings !== 'object') {
    errors.push('Missing settings object.');
  } else {
    const s = data.settings as Record<string, unknown>;
    
    // Check for deep/malformed structure
    const allowedKeys = ['studentBatch', 'targetPercentage', 'notificationSettings'];
    const keys = Object.keys(s);
    if (keys.some(k => !allowedKeys.includes(k))) {
      errors.push('Settings object contains unknown/malformed attributes.');
    }

    if (!['Batch I', 'Batch II', 'All'].includes(s.studentBatch as string)) {
      errors.push(`settings: invalid studentBatch "${s.studentBatch}".`);
    }
    if (typeof s.targetPercentage !== 'number' || s.targetPercentage < 0 || s.targetPercentage > 1) {
      errors.push(`settings: invalid targetPercentage ${s.targetPercentage}.`);
    }
  }

  return { valid: errors.length === 0, errors };
};
