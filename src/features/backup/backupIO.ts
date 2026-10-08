import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { StorageService } from '../../storage/StorageService';
import {
  AttendanceRecord,
  TimetableEntry,
  AppSettings,
  BackupDocument,
  ValidationResult,
} from '../../types';
import { createBackupDocument, validateBackupDocument } from './backupService';

const ATTENDANCE_KEY = '@tracker_attendance_records';
const TIMETABLE_KEY = '@tracker_timetable';
const SETTINGS_KEY = '@tracker_settings';
const SAFETY_SNAPSHOT_KEY = '@tracker_safety_snapshot';

/**
 * Reads all current local data and returns a BackupDocument.
 * Does NOT modify local data.
 */
export const exportBackup = async (): Promise<BackupDocument> => {
  const records = await StorageService.get<AttendanceRecord[]>(ATTENDANCE_KEY) || [];
  const timetable = await StorageService.get<TimetableEntry[]>(TIMETABLE_KEY) || [];
  const settings = await StorageService.get<AppSettings>(SETTINGS_KEY) || {
    studentBatch: 'Batch I' as const,
    targetPercentage: 0.75,
  };

  return createBackupDocument(records, timetable, settings);
};

/**
 * Exports backup as a JSON file and shares it via the platform share sheet.
 */
export const exportAndShareBackup = async (): Promise<void> => {
  const backup = await exportBackup();
  const json = JSON.stringify(backup, null, 2);
  const fileName = `tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

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

  try {
    return JSON.parse(content);
  } catch {
    throw new Error('Selected file is not valid JSON.');
  }
};

/**
 * Creates a safety snapshot of all current local data before destructive operations.
 * Stored under a dedicated key so it can be recovered if restore fails.
 */
export const createSafetySnapshot = async (): Promise<void> => {
  const backup = await exportBackup();
  await StorageService.set(SAFETY_SNAPSHOT_KEY, backup);
};

/**
 * Recovers local data from the safety snapshot.
 * Used if a restore operation fails partway through.
 */
export const recoverFromSnapshot = async (): Promise<boolean> => {
  const snapshot = await StorageService.get<BackupDocument>(SAFETY_SNAPSHOT_KEY);
  if (!snapshot || !snapshot.data) {
    return false;
  }

  try {
    await StorageService.set(ATTENDANCE_KEY, snapshot.data.attendanceRecords);
    await StorageService.set(TIMETABLE_KEY, snapshot.data.timetable);
    await StorageService.set(SETTINGS_KEY, snapshot.data.settings);
    return true;
  } catch {
    return false;
  }
};

/**
 * Restores local data from a validated BackupDocument.
 * MUST be called only after validation passes and user confirms.
 *
 * Flow:
 * 1. Create safety snapshot
 * 2. Replace local data
 * 3. Verify replacement
 * 4. If verification fails, recover from snapshot
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

  // Step 2: Replace local data
  try {
    await StorageService.set(ATTENDANCE_KEY, backup.data.attendanceRecords);
    await StorageService.set(TIMETABLE_KEY, backup.data.timetable);
    await StorageService.set(SETTINGS_KEY, backup.data.settings);
  } catch (e) {
    // Partial failure — attempt recovery
    const recovered = await recoverFromSnapshot();
    if (recovered) {
      return { success: false, error: 'Restore failed during write. Previous data has been recovered from the safety snapshot.' };
    }
    return { success: false, error: 'CRITICAL: Restore failed and recovery also failed. Your previous data was saved as a safety snapshot.' };
  }

  // Step 3: Verify replacement
  try {
    const verifyRecords = await StorageService.get<AttendanceRecord[]>(ATTENDANCE_KEY);
    const verifyTimetable = await StorageService.get<TimetableEntry[]>(TIMETABLE_KEY);
    const verifySettings = await StorageService.get<AppSettings>(SETTINGS_KEY);

    if (
      !verifyRecords ||
      !verifyTimetable ||
      !verifySettings ||
      verifyRecords.length !== backup.data.attendanceRecords.length ||
      verifyTimetable.length !== backup.data.timetable.length
    ) {
      // Verification failed — recover
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

  // Step 4: Clean up snapshot (optional, keep it as extra safety)
  return { success: true };
};
