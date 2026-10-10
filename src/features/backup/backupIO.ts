import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { StorageService } from '../../storage/StorageService';
import { getAttendanceRecords, getTimetable, getSettings, restoreBackupData } from '../../db/repositories';
import {
  AttendanceRecord,
  TimetableEntry,
  AppSettings,
  BackupDocument,
  ValidationResult,
  Habit,
  HabitEntry,
} from '../../types';
import { createBackupDocument, validateBackupDocument } from './backupService';

import { getHabits, getHabitEntriesByHabit } from '../../db/habitRepositories';

const SAFETY_SNAPSHOT_KEY = '@tracker_safety_snapshot';

/**
 * Reads all current local data and returns a BackupDocument.
 * Does NOT modify local data.
 */
export const exportBackup = async (): Promise<BackupDocument> => {
  const records = await getAttendanceRecords() || [];
  const timetable = await getTimetable() || [];
  const settings = await getSettings() || {
    studentBatch: 'Batch I' as const,
    targetPercentage: 0.75,
  };
  const habits = await getHabits() || [];
  let habitEntries: HabitEntry[] = [];
  for (const h of habits) {
    const entries = await getHabitEntriesByHabit(h.id);
    habitEntries = habitEntries.concat(entries);
  }

  return createBackupDocument(records, timetable, settings, habits, habitEntries);
};

/**
 * Exports backup as a JSON file and shares it via the platform share sheet.
 */
export const exportAndShareBackup = async (): Promise<void> => {
  const backup = await exportBackup();
  const json = JSON.stringify(backup, null, 2);
  const fileName = `tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const filePath = `${FileSystem.Paths.document.uri}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/json',
      dialogTitle: 'Export Tracker Backup',
    });
  } else {
    throw new Error('Sharing is not available on this device.');
  }
};

/**
 * Opens a document picker and reads the selected JSON file.
 * Returns parsed content or null if cancelled.
 */
export const pickBackupFile = async (): Promise<unknown | null> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (content.length > 5 * 1024 * 1024) {
    throw new Error('Selected file is too large to be a valid backup (max 5MB).');
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error('Selected file is not valid JSON.');
  }
};

/**
 * Creates a safety snapshot of all current local data before destructive operations.
 * Stored under a dedicated AsyncStorage key so it can be recovered if restore fails.
 */
export const createSafetySnapshot = async (): Promise<void> => {
  const backup = await exportBackup();
  const json = JSON.stringify(backup);
  const dir = `${FileSystem.Paths.document.uri}safety_backups/`;
  
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  // List existing files
  const files = await FileSystem.readDirectoryAsync(dir);
  files.sort(); // Sorting by timestamp since we'll include it in name

  // If we have 3 or more, delete the oldest
  while (files.length >= 3) {
    const oldest = files.shift();
    if (oldest) await FileSystem.deleteAsync(`${dir}${oldest}`);
  }

  const fileName = `snapshot-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(`${dir}${fileName}`, json);
};

/**
 * Recovers local data from the safety snapshot.
 * Used if a restore operation fails partway through.
 */
export const recoverFromSnapshot = async (): Promise<boolean> => {
  const dir = `${FileSystem.Paths.document.uri}safety_backups/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) return false;

  const files = await FileSystem.readDirectoryAsync(dir);
  if (files.length === 0) return false;

  files.sort(); // Ascending
  const newest = files[files.length - 1];

  try {
    const jsonStr = await FileSystem.readAsStringAsync(`${dir}${newest}`);
    const snapshot: BackupDocument = JSON.parse(jsonStr);
    
    if (!snapshot || !snapshot.data) return false;

    await restoreBackupData(
      snapshot.data.attendanceRecords,
      snapshot.data.timetable,
      snapshot.data.settings,
      snapshot.exportedAt,
      snapshot.data.habits || [],
      snapshot.data.habitEntries || []
    );
    return true;
  } catch {
    return false;
  }
};

/**
 * Restores local data from a validated BackupDocument.
 * MUST be called only after validation passes and user confirms.
 */
export const restoreFromBackup = async (
  backup: BackupDocument
): Promise<{ success: boolean; error?: string }> => {
  // Step 1: Safety snapshot
  try {
    await createSafetySnapshot();
  } catch (e) {
    return { success: false, error: 'Failed to create safety snapshot. Local data was NOT modified.' };
  }

  // Step 2: Replace local SQLite data inside a single transaction
  try {
    const cleanSettings: AppSettings = {
      studentBatch: backup.data.settings.studentBatch,
      targetPercentage: backup.data.settings.targetPercentage,
      notificationSettings: backup.data.settings.notificationSettings ? {
        dailyReminderEnabled: backup.data.settings.notificationSettings.dailyReminderEnabled,
        reminderTime: backup.data.settings.notificationSettings.reminderTime,
        riskAlertsEnabled: backup.data.settings.notificationSettings.riskAlertsEnabled
      } : undefined
    };

    const cleanRecords = backup.data.attendanceRecords.map(r => ({
      id: r.id,
      subjectId: r.subjectId,
      component: r.component,
      date: r.date,
      timetableEntryId: r.timetableEntryId,
      status: r.status,
      weight: r.weight,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));

    const cleanTimetable = backup.data.timetable.map(t => ({
      id: t.id,
      dayOfWeek: t.dayOfWeek,
      startTime: t.startTime,
      endTime: t.endTime,
      subjectId: t.subjectId,
      component: t.component,
      isAttendanceBearing: t.isAttendanceBearing,
      weight: t.weight,
      batchConstraint: t.batchConstraint
    }));

    const { conflicts } = await restoreBackupData(cleanRecords, cleanTimetable, cleanSettings, backup.exportedAt); if (conflicts.length > 0) { console.warn("Backup restored with conflicts:", conflicts); }
    
  } catch (e) {
    // Partial failure 
    const recovered = await recoverFromSnapshot();
    if (recovered) {
      return { success: false, error: 'Restore failed during write. Previous data has been recovered from the safety snapshot.' };
    }
    return { success: false, error: 'CRITICAL: Restore failed and recovery also failed. Your previous data was saved as a safety snapshot.' };
  }

  // Step 3: Verify replacement (Assuming transaction guarantees this, but we can read it to be 100% sure)
  try {
    const verifyRecords = await getAttendanceRecords();
    const verifyTimetable = await getTimetable();
    const verifySettings = await getSettings();

    if (
      !verifyRecords ||
      !verifyTimetable ||
      !verifySettings ||
      verifyRecords.length !== backup.data.attendanceRecords.length ||
      verifyTimetable.length !== backup.data.timetable.length
    ) {
      // Verification failed
      const recovered = await recoverFromSnapshot();
      if (recovered) {
        return { success: false, error: 'Restore verification failed. Previous data has been recovered.' };
      }
      return { success: false, error: 'CRITICAL: Verification failed and recovery also failed.' };
    }
  } catch {
    // Verification read failed
    return { success: false, error: 'Could not verify restored data.' };
  }

  return { success: true };
};
