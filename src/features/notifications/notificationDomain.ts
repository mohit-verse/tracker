import { TimetableEntry, BatchType } from '../../types';

/**
 * Pure domain logic to determine if a specific weekday should have a reminder.
 */
export const isDayEligibleForReminder = (
  dayOfWeek: number,
  timetable: TimetableEntry[],
  userBatch: BatchType
): boolean => {
  const dayEntries = timetable.filter(entry => {
    if (!entry.isAttendanceBearing || entry.component === 'none') return false;
    if (entry.dayOfWeek !== dayOfWeek) return false;
    if (entry.batchConstraint && entry.batchConstraint !== 'All' && entry.batchConstraint !== userBatch) {
      return false;
    }
    return true;
  });
  
  return dayEntries.length > 0;
};

/**
 * Checks if a specific calendar date is eligible for a reminder, considering holidays.
 */
export const isDateEligibleForReminder = (
  date: Date,
  timetable: TimetableEntry[],
  userBatch: BatchType,
  holidays: string[] = []
): boolean => {
  const dateStr = date.toISOString().split('T')[0];
  if (holidays.includes(dateStr)) return false;
  return isDayEligibleForReminder(date.getDay(), timetable, userBatch);
};
