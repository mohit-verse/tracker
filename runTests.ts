// @ts-ignore
(global as any).__DEV__ = true;
import {
  calculateAttendance,
  getMaxMissableWeight,
  getRequiredAttendanceWeight,
  getApplicableSessions,
} from './src/features/attendance/attendanceService';
import { AttendanceRecord, TimetableEntry } from './src/types';
import { isDayEligibleForReminder } from './src/features/notifications/notificationDomain';
import { createBackupDocument, validateBackupDocument } from './src/features/backup/backupService';

let passed = 0;
let failed = 0;

function assertEqual(expected: any, actual: any, testName: string) {
  if (expected === actual || (expected == null && actual == null)) {
    passed++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`❌ [FAIL] ${testName}`);
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
  }
}

function assertCloseTo(expected: number, actual: number, testName: string, precision = 4) {
  if (Math.abs(expected - actual) < Math.pow(10, -precision)) {
    passed++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`❌ [FAIL] ${testName}`);
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
  }
}

function assertTrue(condition: boolean, testName: string) {
  if (condition) {
    passed++;
    console.log(`✅ [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`❌ [FAIL] ${testName}`);
  }
}

const createRecord = (id: string, status: 'present' | 'absent', weight: number, component: 'theory' | 'practical' | 'none' = 'theory'): AttendanceRecord => ({
  id,
  subjectId: 'sub_1',
  component,
  date: '2023-10-01',
  timetableEntryId: 'tt_1',
  status,
  weight,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

console.log('Running Tests...\n');
console.log('=== Milestone 2: Attendance Domain ===');

// Test 1
const summary1 = calculateAttendance([]);
assertEqual(0, summary1.conductedWeight, 'Test 1: 0 conducted weight');
assertEqual(null, summary1.percentage, 'Test 1: 0 conducted percentage');

// Test 2
const summary2 = calculateAttendance([createRecord('1', 'present', 1)]);
assertEqual(100, summary2.percentage, 'Test 2: 1 attended / 1 conducted');

// Test 3
const records3 = [
  ...Array(5).fill(0).map((_, i) => createRecord(`p${i}`, 'present', 1)),
  ...Array(2).fill(0).map((_, i) => createRecord(`a${i}`, 'absent', 1)),
];
assertCloseTo(71.4285, calculateAttendance(records3).percentage as number, 'Test 3: 5 attended / 7 conducted', 3);

// Test 4
const records4 = [
  ...Array(3).fill(0).map((_, i) => createRecord(`p${i}`, 'present', 1)),
  createRecord('a1', 'absent', 1),
];
assertEqual(75, calculateAttendance(records4).percentage, 'Test 4: 3 attended / 4 conducted');

// Test 5
const records5 = [
  ...Array(2).fill(0).map((_, i) => createRecord(`p${i}`, 'present', 1)),
  ...Array(2).fill(0).map((_, i) => createRecord(`a${i}`, 'absent', 1)),
];
assertEqual(50, calculateAttendance(records5).percentage, 'Test 5: 2 attended / 4 conducted');

// Test 6
const summary6 = calculateAttendance([createRecord('1', 'present', 2)]);
assertEqual(2, summary6.conductedWeight, 'Test 6: Project Work-1 conducted');
assertEqual(2, summary6.attendedWeight, 'Test 6: Project Work-1 attended');
assertEqual(100, summary6.percentage, 'Test 6: Project Work-1 percentage');

// Test 7
const summary7 = calculateAttendance([createRecord('1', 'absent', 2)]);
assertEqual(0, summary7.attendedWeight, 'Test 7: Project Work-1 absent attended');
assertEqual(0, summary7.percentage, 'Test 7: Project Work-1 absent percentage');

// Test 8
const records8 = [
  createRecord('1', 'present', 1),
  createRecord('2', 'present', 2),
  createRecord('3', 'absent', 1),
];
const summary8 = calculateAttendance(records8);
assertEqual(4, summary8.conductedWeight, 'Test 8: Mixed conducted');
assertEqual(3, summary8.attendedWeight, 'Test 8: Mixed attended');
assertEqual(75, summary8.percentage, 'Test 8: Mixed percentage');

// Test 9
assertEqual(0, getMaxMissableWeight(5, 7, 0.75), 'Test 9: Planner max missable weight (5/7)');
assertEqual(2, getMaxMissableWeight(9, 10, 0.75), 'Test 9: Planner max missable weight (9/10)');

// Test 10
assertEqual(1, getRequiredAttendanceWeight(5, 7, 0.75), 'Test 10: Planner min future attended (5/7)');
assertEqual(4, getRequiredAttendanceWeight(2, 4, 0.75), 'Test 10: Planner min future attended (2/4)');

// Test 11
assertEqual(0, getRequiredAttendanceWeight(3, 4, 0.75), 'Test 11: Planner already >= target (3/4)');

// Test 12
const date12 = new Date('2023-10-05T00:00:00'); // Thursday
const timetable12: TimetableEntry[] = [
  { id: '1', dayOfWeek: 4, startTime: '10:00', endTime: '11:00', subjectId: 'sub1', component: 'practical', isAttendanceBearing: true, weight: 1, batchConstraint: 'Batch I' },
  { id: '2', dayOfWeek: 4, startTime: '11:00', endTime: '12:00', subjectId: 'sub2', component: 'practical', isAttendanceBearing: true, weight: 1, batchConstraint: 'Batch II' },
  { id: '3', dayOfWeek: 4, startTime: '12:00', endTime: '13:00', subjectId: 'sub3', component: 'theory', isAttendanceBearing: true, weight: 1, batchConstraint: 'All' },
];
const sessions12 = getApplicableSessions(date12, timetable12, 'Batch I');
assertEqual(2, sessions12.length, 'Test 12: Batch filtering count');
assertTrue(sessions12.some(s => s.id === '1'), 'Test 12: Batch I included');
assertTrue(sessions12.some(s => s.id === '3'), 'Test 12: All included');
assertTrue(!sessions12.some(s => s.id === '2'), 'Test 12: Batch II excluded');

// Test 13
const timetable13: TimetableEntry[] = [
  { id: '1', dayOfWeek: 4, startTime: '10:00', endTime: '11:00', subjectId: 'sub1', component: 'practical', isAttendanceBearing: true, weight: 1, batchConstraint: 'All' },
  { id: '2', dayOfWeek: 4, startTime: '11:00', endTime: '12:00', subjectId: 'sports', component: 'none', isAttendanceBearing: false, weight: 0, batchConstraint: 'All' },
];
const sessions13 = getApplicableSessions(date12, timetable13, 'Batch I');
assertEqual(1, sessions13.length, 'Test 13: Sports/Library exclusion count');
assertEqual('1', sessions13[0].id, 'Test 13: Sports/Library exclusion correct ID');

console.log('\n=== Milestone 5: Notification Domain ===');

// Test 14-17: Notification eligibility
const mockTimetable14: TimetableEntry[] = [
  { id: '1', dayOfWeek: 1, startTime: '10:00', endTime: '11:00', subjectId: 's1', component: 'theory', isAttendanceBearing: true, weight: 1, batchConstraint: 'All' },
  { id: '2', dayOfWeek: 2, startTime: '10:00', endTime: '11:00', subjectId: 's2', component: 'none', isAttendanceBearing: false, weight: 0, batchConstraint: 'All' },
  { id: '3', dayOfWeek: 3, startTime: '10:00', endTime: '11:00', subjectId: 's3', component: 'theory', isAttendanceBearing: true, weight: 1, batchConstraint: 'Batch II' },
];

assertEqual(true, isDayEligibleForReminder(1, mockTimetable14, 'Batch I'), 'Test 14: Attendance-bearing day is eligible');
assertEqual(false, isDayEligibleForReminder(2, mockTimetable14, 'Batch I'), 'Test 15: Non-attendance day is not eligible');
assertEqual(false, isDayEligibleForReminder(3, mockTimetable14, 'Batch I'), 'Test 16: Batch mismatch is not eligible');
assertEqual(true, isDayEligibleForReminder(3, mockTimetable14, 'Batch II'), 'Test 17: Batch match is eligible');

console.log('\n=== Milestone 6: Backup Domain ===');

// Test 18: Create valid backup document
const testRecords: AttendanceRecord[] = [
  createRecord('r1', 'present', 1, 'theory'),
  createRecord('r2', 'absent', 2, 'practical'),
];
const testTimetable: TimetableEntry[] = [
  { id: 'tt1', dayOfWeek: 3, startTime: '10:00', endTime: '11:00', subjectId: 'sub_1', component: 'theory', isAttendanceBearing: true, weight: 1, batchConstraint: 'All' },
];
const testSettings = { studentBatch: 'Batch I' as const, targetPercentage: 0.75, notificationSettings: { dailyReminderEnabled: true, riskAlertsEnabled: false, reminderTime: '18:00' } };

const backup = createBackupDocument(testRecords, testTimetable, testSettings);
assertEqual('tracker', backup.appId, 'Test 18: Backup appId is tracker');
assertEqual(1, backup.schemaVersion, 'Test 18: Backup schemaVersion is 1');
assertTrue(backup.exportedAt.length > 0, 'Test 18: Backup has exportedAt');
assertEqual(2, backup.data.attendanceRecords.length, 'Test 18: Backup has 2 attendance records');
assertEqual(1, backup.data.timetable.length, 'Test 18: Backup has 1 timetable entry');

// Test 19: Validate valid backup
const validResult = validateBackupDocument(backup);
assertTrue(validResult.valid, 'Test 19: Valid backup passes validation');

// Test 20: Reject malformed JSON (non-object)
const badResult1 = validateBackupDocument('not an object' as any);
assertTrue(!badResult1.valid, 'Test 20: Non-object rejected');

// Test 21: Reject wrong appId
const badBackup21 = { ...backup, appId: 'wrong' };
const badResult21 = validateBackupDocument(badBackup21);
assertTrue(!badResult21.valid, 'Test 21: Wrong appId rejected');

// Test 22: Reject unsupported schema version
const badBackup22 = { ...backup, schemaVersion: 99 };
const badResult22 = validateBackupDocument(badBackup22);
assertTrue(!badResult22.valid, 'Test 22: Unsupported schema version rejected');

// Test 23: Reject missing data section
const badBackup23 = { appId: 'tracker', schemaVersion: 1, exportedAt: new Date().toISOString() };
const badResult23 = validateBackupDocument(badBackup23 as any);
assertTrue(!badResult23.valid, 'Test 23: Missing data section rejected');

// Test 24: Round-trip preserves attendance weight
const roundTripRecord = backup.data.attendanceRecords.find(r => r.id === 'r2');
assertEqual(2, roundTripRecord?.weight, 'Test 24: Project Work-1 weight 2 survives round-trip');
assertEqual('absent', roundTripRecord?.status, 'Test 24: Status survives round-trip');
assertEqual('practical', roundTripRecord?.component, 'Test 24: Component survives round-trip');

// Test 25: Round-trip preserves timetable IDs
assertEqual('tt1', backup.data.timetable[0].id, 'Test 25: Timetable ID survives round-trip');

// Test 26: Round-trip preserves notification settings
assertEqual(true, backup.data.settings.notificationSettings?.dailyReminderEnabled, 'Test 26: Notification settings survive round-trip');
assertEqual('18:00', backup.data.settings.notificationSettings?.reminderTime, 'Test 26: Reminder time survives round-trip');

// Test 27: Reject invalid attendance record (missing fields)
const badBackup27 = {
  ...backup,
  data: { ...backup.data, attendanceRecords: [{ id: 'x' }] },
};
const badResult27 = validateBackupDocument(badBackup27 as any);
assertTrue(!badResult27.valid, 'Test 27: Invalid attendance record rejected');

// Test 28: Reject invalid timetable entry (missing fields)
const badBackup28 = {
  ...backup,
  data: { ...backup.data, timetable: [{ id: 'y' }] },
};
const badResult28 = validateBackupDocument(badBackup28 as any);
assertTrue(!badResult28.valid, 'Test 28: Invalid timetable entry rejected');

console.log('\n=== Milestone 7: Privacy & Safety Domain ===');

// Test 29: Export schema contains intended fields and no extra secrets
const serializedBackup = JSON.stringify(backup);
assertTrue(!serializedBackup.includes('token'), 'Test 29: Export excludes secrets');
assertTrue(!serializedBackup.includes('oauth'), 'Test 29: Export excludes oauth strings');
assertTrue(serializedBackup.includes('attendanceRecords'), 'Test 29: Export includes attendanceRecords');

// Test 30: Reject malformed deep/oversized payload
const badBackup30 = {
  ...backup,
  data: { ...backup.data, settings: { nested: { extremely: { deep: 'value' } } } }
};
const badResult30 = validateBackupDocument(badBackup30 as any);
assertTrue(!badResult30.valid, 'Test 30: Deep/malformed structure is rejected');

import { calculateHabitStats } from './src/features/habits/habitAnalytics';

console.log('\n=== Milestone 8: Habit Analytics Domain ===');

const baseHabit = {
  id: 'h1',
  name: 'Read',
  frequency_type: 'daily' as const,
  target_count: 1,
  start_date: '2023-10-01',
  reminder_enabled: false,
  created_at: '2023-10-01',
  updated_at: '2023-10-01'
};

const createEntry = (date: string) => ({
  id: `e_${date}`,
  habit_id: 'h1',
  date,
  count: 1,
  created_at: date,
  updated_at: date
});

// Test 31: calculates 0 streaks if start_date is in the future
const stats1 = calculateHabitStats(baseHabit, [], '2023-09-30');
assertEqual(0, stats1.currentStreak, 'Test 31: Future start date current streak');
assertEqual(0, stats1.longestStreak, 'Test 31: Future start date longest streak');

// Test 32: calculates correct eligible days and unbroken streak
const entries32 = [createEntry('2023-10-01'), createEntry('2023-10-02'), createEntry('2023-10-03')];
const stats32 = calculateHabitStats(baseHabit, entries32, '2023-10-03');
assertEqual(3, stats32.totalEligibleDays, 'Test 32: Unbroken eligible days');
assertEqual(3, stats32.currentStreak, 'Test 32: Unbroken current streak');
assertEqual(1, stats32.completionRate, 'Test 32: Unbroken completion rate');

// Test 33: does not break streak if today is missing (grace period)
const entries33 = [createEntry('2023-10-01'), createEntry('2023-10-02')];
const stats33 = calculateHabitStats(baseHabit, entries33, '2023-10-03');
assertEqual(2, stats33.currentStreak, 'Test 33: Grace period current streak');
assertEqual(2, stats33.longestStreak, 'Test 33: Grace period longest streak');

// Test 34: breaks streak if a past day is missing
const entries34 = [createEntry('2023-10-01'), createEntry('2023-10-02'), createEntry('2023-10-04')];
const stats34 = calculateHabitStats(baseHabit, entries34, '2023-10-04');
assertEqual(4, stats34.totalEligibleDays, 'Test 34: Broken eligible days');
assertEqual(3, stats34.totalCompletedDays, 'Test 34: Broken completed days');
assertEqual(1, stats34.currentStreak, 'Test 34: Broken current streak');
assertEqual(2, stats34.longestStreak, 'Test 34: Broken longest streak');

// Test 35: completely empty history returns zeros
const stats35 = calculateHabitStats(baseHabit, [], '2023-10-04');
assertEqual(4, stats35.totalEligibleDays, 'Test 35: Empty eligible days');
assertEqual(0, stats35.totalCompletedDays, 'Test 35: Empty completed');
assertEqual(0, stats35.currentStreak, 'Test 35: Empty current streak');
assertEqual(0, stats35.longestStreak, 'Test 35: Empty longest streak');

// Test 36: missing grace period followed by check (if checking today after missing yesterday, streak is still 1)
const entries36 = [createEntry('2023-10-01'), createEntry('2023-10-03')];
const stats36 = calculateHabitStats(baseHabit, entries36, '2023-10-03');
assertEqual(3, stats36.totalEligibleDays, 'Test 36: Eligible days');
assertEqual(1, stats36.currentStreak, 'Test 36: Streak is 1');
assertEqual(1, stats36.longestStreak, 'Test 36: Longest streak is 1');

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
