import { useState, useCallback, useEffect } from 'react';
import { StorageService } from '../storage/StorageService';
import { TimetableEntry } from '../types';
import { MOCK_TIMETABLE } from './mock';

const TIMETABLE_KEY = '@tracker_timetable';

export const useTimetable = () => {
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTimetable = useCallback(async () => {
    try {
      setError(null);
      const savedTimetable = await StorageService.get<TimetableEntry[]>(TIMETABLE_KEY);
      if (savedTimetable && savedTimetable.length > 0) {
        setTimetable(savedTimetable);
      } else if (savedTimetable === null) {
        // Clear memory if storage is empty, unless it's the very first time where we seed
        setTimetable([]);
      }
      setIsLoaded(true);
    } catch (e: any) {
      setError(e.message || 'Failed to load timetable storage');
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadTimetable();
  }, [loadTimetable]);

  const saveEntry = async (entry: TimetableEntry) => {
    setTimetable(prev => {
      const existingIndex = prev.findIndex(e => e.id === entry.id);
      let updated: TimetableEntry[];
      if (existingIndex >= 0) {
        updated = [...prev];
        updated[existingIndex] = entry;
      } else {
        updated = [...prev, entry];
      }
      
      // Ensure chronological ordering by start time
      updated.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) {
          return a.dayOfWeek - b.dayOfWeek;
        }
        return a.startTime.localeCompare(b.startTime);
      });

      StorageService.set(TIMETABLE_KEY, updated);
      return updated;
    });
  };

  const deleteEntry = async (id: string) => {
    setTimetable(prev => {
      const updated = prev.filter(e => e.id !== id);
      StorageService.set(TIMETABLE_KEY, updated);
      return updated;
    });
  };

  return {
    timetable,
    isLoaded,
    error,
    loadTimetable,
    saveEntry,
    deleteEntry
  };
};
