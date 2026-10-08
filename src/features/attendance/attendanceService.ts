import { AttendanceRecord, AttendanceSummary, TimetableEntry, BatchType } from '../../types';

export const calculateAttendance = (
  records: AttendanceRecord[],
  targetPercentage: number = 0.75
): AttendanceSummary => {
  let attendedWeight = 0;
  let conductedWeight = 0;

  for (const record of records) {
    if (record.weight < 0) {
      throw new Error(`Invalid negative weight on record ${record.id}`);
    }
    
    // Safety check - skip if it's a non-attendance component somehow
    if (record.component === 'none') continue;
    
    conductedWeight += record.weight;
    if (record.status === 'present') {
      attendedWeight += record.weight;
    }
  }

  let percentage: number | null = null;
  let isAboveTarget: boolean | null = null;

  if (conductedWeight > 0) {
    percentage = (attendedWeight / conductedWeight) * 100;
    isAboveTarget = percentage >= (targetPercentage * 100);
  }

  return {
    attendedWeight,
    conductedWeight,
    percentage,
    targetPercentage,
    isAboveTarget,
  };
};

export const getMaxMissableWeight = (
  attended: number,
  conducted: number,
  target: number = 0.75
): number => {
  if (conducted === 0) return 0;
  
  // A / (C + M) >= T => A >= T * (C + M) => A / T >= C + M => M <= (A / T) - C
  const maxMissable = (attended / target) - conducted;
  return Math.max(0, Math.floor(maxMissable));
};

export const getRequiredAttendanceWeight = (
  attended: number,
  conducted: number,
  target: number = 0.75
): number => {
  if (conducted === 0 && attended === 0) {
    // If we have no classes yet, to stay above 75%, how many do we need? 
    // Technically 0 right now, but the first class we miss we drop to 0%.
    // So 0 is mathematically fine.
    return 0;
  }
  
  const currentRatio = conducted > 0 ? attended / conducted : 1;
  if (currentRatio >= target) {
    return 0;
  }

  // (A + X) / (C + X) >= T => A + X >= T*C + T*X => X - T*X >= T*C - A => X * (1 - T) >= T*C - A => X >= (T*C - A) / (1 - T)
  const required = (target * conducted - attended) / (1 - target);
  return Math.max(0, Math.ceil(required));
};

export const calculateProjectedAttendance = (
  attended: number,
  conducted: number,
  futureAttended: number,
  futureMissed: number
): number | null => {
  const totalConducted = conducted + futureAttended + futureMissed;
  if (totalConducted === 0) return null;
  
  const totalAttended = attended + futureAttended;
  return (totalAttended / totalConducted) * 100;
};

export const isAttendanceTargetAchievable = (
  attended: number,
  conducted: number,
  target: number = 0.75,
  remainingPossibleWeight: number
): boolean => {
  const maxPossibleAttended = attended + remainingPossibleWeight;
  const maxPossibleConducted = conducted + remainingPossibleWeight;
  
  if (maxPossibleConducted === 0) return true;
  return (maxPossibleAttended / maxPossibleConducted) >= target;
};

export const getApplicableSessions = (
  date: Date,
  timetable: TimetableEntry[],
  userBatch: BatchType
): TimetableEntry[] => {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  return timetable.filter(entry => {
    // Exclude non-attendance activities explicitly
    if (!entry.isAttendanceBearing || entry.component === 'none') {
      return false;
    }
    
    // Must match the day of the week
    if (entry.dayOfWeek !== dayOfWeek) {
      return false;
    }
    
    // Check batch constraints
    if (entry.batchConstraint && entry.batchConstraint !== 'All') {
      if (entry.batchConstraint !== userBatch) {
        return false;
      }
    }
    
    return true;
  });
};
