import { useState, useEffect, useCallback } from 'react';
import { Habit, HabitEntry } from '../types';
import { getHabits, createHabit, updateHabit, deleteHabit, getHabitEntriesByHabit, toggleHabitEntry as dbToggleHabitEntry } from '../db/habitRepositories';
import { getDatabase } from '../db';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { reconcileHabitReminders } from '../features/notifications/notificationService';

export const useHabits = () => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entries, setEntries] = useState<Record<string, HabitEntry[]>>({}); // mapped by habitId
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const triggerRemindersUpdate = useCallback((h: Habit[], e: Record<string, HabitEntry[]>) => {
    reconcileHabitReminders(h, e).catch(() => {});
  }, []);

  useEffect(() => {
    if (isLoaded) {
      triggerRemindersUpdate(habits, entries);
    }
  }, [habits, entries, isLoaded, triggerRemindersUpdate]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      await getDatabase(); // Ensure DB is initialized
      const loadedHabits = await getHabits();
      setHabits(loadedHabits);

      const entriesMap: Record<string, HabitEntry[]> = {};
      for (const h of loadedHabits) {
        entriesMap[h.id] = await getHabitEntriesByHabit(h.id);
      }
      setEntries(entriesMap);
      setIsLoaded(true);
      triggerRemindersUpdate(loadedHabits, entriesMap);
    } catch (e: any) {
      setError(e.message || 'Failed to load habits');
      setIsLoaded(true);
    }
  }, []);

  const addHabit = useCallback(async (
    name: string, 
    frequency_type: 'daily' | 'weekly', 
    target_count: number, 
    start_date: string, 
    reminder_time: string | null = null, 
    reminder_enabled: boolean = false
  ) => {
    if (!name.trim()) throw new Error('Habit name is required');
    const now = new Date().toISOString();
    const newHabit: Habit = {
      id: uuidv4(),
      name: name.trim(),
      frequency_type,
      target_count,
      start_date,
      reminder_time,
      reminder_enabled,
      created_at: now,
      updated_at: now,
    };
    await createHabit(newHabit);
    setHabits(prev => [newHabit, ...prev]);
    setEntries(prev => ({ ...prev, [newHabit.id]: [] }));
    return newHabit;
  }, []);

  const editHabit = useCallback(async (
    id: string,
    name: string,
    start_date: string,
    reminder_time: string | null = null,
    reminder_enabled: boolean = false
  ) => {
    if (!name.trim()) throw new Error('Habit name is required');
    const existing = habits.find(h => h.id === id);
    if (!existing) throw new Error('Habit not found');
    
    const updated: Habit = {
      ...existing,
      name: name.trim(),
      start_date,
      reminder_time,
      reminder_enabled,
      updated_at: new Date().toISOString()
    };
    await updateHabit(updated);
    setHabits(prev => prev.map(h => h.id === id ? updated : h));
  }, [habits]);

  const removeHabit = useCallback(async (id: string) => {
    await deleteHabit(id);
    setHabits(prev => prev.filter(h => h.id !== id));
    setEntries(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const toggleEntry = useCallback(async (habitId: string, date: string, isChecked: boolean) => {
    const timestamp = new Date().toISOString();
    const entryId = uuidv4();
    await dbToggleHabitEntry(habitId, date, isChecked, entryId, timestamp);
    
    // Update local state optimistically
    setEntries(prev => {
      const habitEntries = prev[habitId] || [];
      if (isChecked) {
        return {
          ...prev,
          [habitId]: [
            ...habitEntries.filter(e => e.date !== date), 
            { id: entryId, habit_id: habitId, date, count: 1, created_at: timestamp, updated_at: timestamp }
          ]
        };
      } else {
        return {
          ...prev,
          [habitId]: habitEntries.filter(e => e.date !== date)
        };
      }
    });
  }, []);

  // Helper selectors
  const getCheckedDates = useCallback((habitId: string) => {
    return (entries[habitId] || []).map(e => e.date);
  }, [entries]);

  const isHabitCheckedOnDate = useCallback((habitId: string, date: string) => {
    return (entries[habitId] || []).some(e => e.date === date);
  }, [entries]);

  return {
    habits,
    entries,
    isLoaded,
    error,
    addHabit,
    editHabit,
    removeHabit,
    toggleEntry,
    getCheckedDates,
    isHabitCheckedOnDate,
    refresh: loadData
  };
};
