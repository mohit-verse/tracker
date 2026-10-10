export type AttendanceComponent = 'theory' | 'practical' | 'none';
export type AttendanceStatus = 'present' | 'absent';
export type BatchType = 'Batch I' | 'Batch II' | 'All';

export interface Subject {
  id: string;
  name: string;
  hasTheory: boolean;
  hasPractical: boolean;
}

export interface TimetableEntry {
  id: string;
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 0; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // HH:mm format
  endTime: string;
  subjectId: string; // Or activity identifier like 'sports'
  component: AttendanceComponent;
  isAttendanceBearing: boolean;
  weight: number;
  batchConstraint?: BatchType;
  displayName?: string;
}

export interface AttendanceRecord {
  id: string;
  subjectId: string;
  component: AttendanceComponent;
  date: string; // YYYY-MM-DD
  timetableEntryId: string;
  status: AttendanceStatus;
  weight: number;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface NotificationSettings {
  dailyReminderEnabled: boolean;
  riskAlertsEnabled: boolean;
  reminderTime: string; // HH:mm
}

export interface AppSettings {
  studentBatch: BatchType;
  targetPercentage: number; // default 0.75
  notificationSettings?: NotificationSettings;
}

export interface AttendanceSummary {
  attendedWeight: number;
  conductedWeight: number;
  percentage: number | null;
  targetPercentage: number;
  isAboveTarget: boolean | null;
}

export interface BackupData {
  attendanceRecords: AttendanceRecord[];
  timetable: TimetableEntry[];
  settings: AppSettings;
  subjects?: Subject[];
  habits?: Habit[];
  habitEntries?: HabitEntry[];
}

export interface BackupDocument {
  appId: 'tracker';
  schemaVersion: number;
  exportedAt: string; // ISO string
  data: BackupData;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface Habit {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  frequency_type: 'daily' | 'weekly';
  target_count: number;
  start_date: string; // YYYY-MM-DD
  reminder_time?: string | null; // HH:mm
  reminder_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface HabitEntry {
  id: string;
  habit_id: string;
  date: string; // YYYY-MM-DD
  count: number;
  created_at: string;
  updated_at: string;
}
