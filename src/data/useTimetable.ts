import { useState, useEffect, useCallback } from 'react';
import { TimetableEntry } from '../types';
import { MOCK_TIMETABLE } from './mock';
import 'react-native-get-random-values';
import { getDatabase } from '../db';
import { getTimetable, saveTimetable } from '../db/repositories';

export const useTimetable = () => {
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTimetable();
  }, []);

  const loadTimetable = useCallback(async () => {
    try {
      setError(null);
      await getDatabase(); // Ensure initialization
      
      const savedTimetable = await getTimetable();
      if (savedTimetable && savedTimetable.length > 0) {
        setTimetable(savedTimetable);
      } else {
        // Fallback to mock for initial state if truly empty
        setTimetable(MOCK_TIMETABLE);
        await saveTimetable(MOCK_TIMETABLE);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load timetable');
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveEntry = useCallback(async (entry: TimetableEntry) => {
    const updated = [...timetable, entry];
    setTimetable(updated);
    try {
      await saveTimetable(updated);
    } catch (e: any) {
      setError('Failed to save timetable: ' + e.message);
      setTimetable(timetable); // rollback
    }
  }, [timetable]);

  const deleteEntry = useCallback(async (id: string) => {
    const updated = timetable.filter(e => e.id !== id);
    setTimetable(updated);
    try {
      await saveTimetable(updated);
    } catch (e: any) {
      setError('Failed to update timetable: ' + e.message);
      setTimetable(timetable); // rollback
    }
  }, [timetable]);

  return {
    timetable,
    isLoaded,
    error,
    saveEntry,
    deleteEntry,
    loadTimetable
  };
};
