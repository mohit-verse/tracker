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
