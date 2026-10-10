import { Habit, HabitEntry } from '../../types';

export interface HabitStats {
  habitId: string;
  name: string;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  totalEligibleDays: number;
  totalCompletedDays: number;
}

export interface AggregateStats {
  overallCompletionRate: number;
  activeHabitsCount: number;
  totalCompletions: number;
}

/**
 * Streak Semantics:
 * - Streaks are calculated from `start_date` up to `today`.
 * - A day is "eligible" if start_date <= day <= today.
 * - An eligible day without an entry breaks the streak.
 * - EXCEPTION: If `today` is missing, the streak is NOT broken yet. The user has until the end of today to complete it.
 *   (i.e., if yesterday is checked but today is unchecked, current streak = streak up to yesterday).
 */
export function calculateHabitStats(habit: Habit, entries: HabitEntry[], todayStr: string): HabitStats {
  const startDate = new Date(habit.start_date);
  const today = new Date(todayStr);
  
  if (startDate > today) {
    return { habitId: habit.id, name: habit.name, currentStreak: 0, longestStreak: 0, completionRate: 0, totalEligibleDays: 0, totalCompletedDays: 0 };
  }

  const checkedDates = new Set(entries.map(e => e.date));

  let currentStreak = 0;
  let longestStreak = 0;
  let totalEligibleDays = 0;
  let totalCompletedDays = 0;
  let runningStreak = 0;

  // Iterate from start_date to today
  let iter = new Date(startDate);
  while (iter <= today) {
    const dateStr = iter.toISOString().split('T')[0];
    totalEligibleDays++;
    
    const isChecked = checkedDates.has(dateStr);
    const isToday = dateStr === todayStr;

    if (isChecked) {
      totalCompletedDays++;
      runningStreak++;
      if (runningStreak > longestStreak) {
        longestStreak = runningStreak;
      }
    } else {
      if (!isToday) {
        runningStreak = 0; // broken streak
      }
    }
    
    iter.setDate(iter.getDate() + 1);
  }

  currentStreak = runningStreak;

  const completionRate = totalEligibleDays > 0 ? totalCompletedDays / totalEligibleDays : 0;

  return {
    habitId: habit.id,
    name: habit.name,
    currentStreak,
    longestStreak,
    completionRate,
    totalEligibleDays,
    totalCompletedDays
  };
}

export function calculateAggregateStats(habits: Habit[], entriesMap: Record<string, HabitEntry[]>, todayStr: string): AggregateStats {
  let totalEligible = 0;
  let totalCompleted = 0;
  let activeHabitsCount = 0;

  for (const habit of habits) {
    if (habit.start_date <= todayStr) {
      activeHabitsCount++;
      const stats = calculateHabitStats(habit, entriesMap[habit.id] || [], todayStr);
      totalEligible += stats.totalEligibleDays;
      totalCompleted += stats.totalCompletedDays;
    }
  }

  return {
    overallCompletionRate: totalEligible > 0 ? totalCompleted / totalEligible : 0,
    activeHabitsCount,
    totalCompletions: totalCompleted
  };
}
