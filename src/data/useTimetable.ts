import { useState, useEffect, useCallback } from 'react';
import { TimetableEntry } from '../types';
import 'react-native-get-random-values';
import { getDatabase } from '../db';
import { getTimetable, saveTimetable } from '../db/repositories';

// Module-level subscribers and cache to ensure all hook instances share the same state
let cachedTimetable: TimetableEntry[] = [];
let isCacheLoaded = false;
const subscribers = new Set<(entries: TimetableEntry[]) => void>();

function notifySubscribers(entries: TimetableEntry[]) {
  cachedTimetable = entries;
  isCacheLoaded = true;
  subscribers.forEach(cb => cb(entries));
}

export const useTimetable = () => {
  const [timetable, setTimetable] = useState<TimetableEntry[]>(cachedTimetable);
  const [isLoaded, setIsLoaded] = useState(isCacheLoaded);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    subscribers.add(setTimetable);
    if (!isCacheLoaded) {
      loadTimetable();
    } else {
      setIsLoaded(true);
    }
    return () => {
      subscribers.delete(setTimetable);
    };
  }, []);

  const loadTimetable = useCallback(async () => {
    try {
      setError(null);
      await getDatabase(); // Ensure initialization
      
      const savedTimetable = await getTimetable();
      notifySubscribers(savedTimetable || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load timetable');
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveEntry = useCallback(async (entry: TimetableEntry) => {
    const updated = [...cachedTimetable.filter(e => e.id !== entry.id), entry];
    notifySubscribers(updated);
    try {
      await saveTimetable(updated);
    } catch (e: any) {
      setError('Failed to save timetable: ' + e.message);
      // reload from DB on failure
      loadTimetable();
    }
  }, [loadTimetable]);

  const deleteEntry = useCallback(async (id: string) => {
    const updated = cachedTimetable.filter(e => e.id !== id);
    notifySubscribers(updated);
    try {
      await saveTimetable(updated);
    } catch (e: any) {
      setError('Failed to update timetable: ' + e.message);
      loadTimetable();
    }
  }, [loadTimetable]);

  return {
    timetable,
    isLoaded,
    error,
    saveEntry,
    deleteEntry,
    loadTimetable
  };
};
