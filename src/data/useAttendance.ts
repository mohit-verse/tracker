import { useState, useEffect, useCallback } from 'react';
import { AttendanceRecord, AttendanceSummary, BatchType, Subject, AppSettings } from '../types';
import { calculateAttendance, getApplicableSessions } from '../features/attendance/attendanceService';
import { MOCK_SUBJECTS } from './mock';
import { useTimetable } from './useTimetable';
import { checkRiskAlerts } from '../features/notifications/notificationService';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { getAttendanceRecords, addAttendanceRecord as dbAddRecord, updateAttendanceRecordDb, deleteAttendanceRecordDb, getSettings, saveSettings } from '../db/repositories';

export const useAttendance = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ studentBatch: 'Batch I', targetPercentage: 0.75 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { timetable, isLoaded: timetableLoaded, loadTimetable } = useTimetable();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      await getDatabase();
      const savedRecords = await getAttendanceRecords();
      if (savedRecords) {
        setRecords(savedRecords);
      } else {
        setRecords([]);
      }
      
      const savedSettings = await getSettings();
      if (savedSettings) {
        setSettings(savedSettings);
      }
      await loadTimetable();
      setIsLoaded(true);
    } catch (e: any) {
      setError(e.message || 'Failed to load storage');
      setIsLoaded(true); 
    }
  }, [loadTimetable]);

  const saveRecord = async (
    subjectId: string,
    component: 'theory' | 'practical' | 'none',
    date: string,
    timetableEntryId: string,
    status: 'present' | 'absent',
    weight: number
  ) => {
    const newRecord: AttendanceRecord = {
      id: uuidv4(),
      subjectId,
      component,
      date,
      timetableEntryId,
      status,
      weight,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Check for duplicate: date + timetableEntryId
    const existingIndex = records.findIndex(
      r => r.date === date && r.timetableEntryId === timetableEntryId
    );

    let updatedRecords;
    if (existingIndex >= 0) {
      // Update existing
      updatedRecords = [...records];
      const idToUpdate = updatedRecords[existingIndex].id;
      updatedRecords[existingIndex] = {
        ...updatedRecords[existingIndex],
        status,
        updatedAt: new Date().toISOString(),
      };
      setRecords(updatedRecords);
      await updateAttendanceRecordDb(idToUpdate, updatedRecords[existingIndex]);
    } else {
      // Add new
      updatedRecords = [...records, newRecord];
      setRecords(updatedRecords);
      await dbAddRecord(newRecord);
    }
    
    // Check risk alerts asynchronously
    if (settings.notificationSettings?.riskAlertsEnabled) {
      setTimeout(() => {
        const summaries = MOCK_SUBJECTS.map(sub => ({
          subjectName: sub.name,
          summary: calculateAttendance(
            updatedRecords.filter(r => r.subjectId === sub.id), 
            settings.targetPercentage
          )
        }));
        checkRiskAlerts(summaries, settings.notificationSettings);
      }, 1000);
    }
  };

  const getSubjectSummary = useCallback((subjectId: string, component: 'theory' | 'practical'): AttendanceSummary => {
    const subjectRecords = records.filter(r => r.subjectId === subjectId && r.component === component);
    return calculateAttendance(subjectRecords, settings.targetPercentage);
  }, [records, settings.targetPercentage]);

  const getTodaySessions = (date: Date) => {
    return getApplicableSessions(date, timetable, settings.studentBatch);
  };

  const getRecordsByDate = (date: string) => {
    return records.filter(r => r.date === date);
  };

  const getSubjectRecords = (subjectId: string, componentFilter?: 'theory' | 'practical' | 'all') => {
    let filtered = records.filter(r => r.subjectId === subjectId);
    if (componentFilter && componentFilter !== 'all') {
      filtered = filtered.filter(r => r.component === componentFilter);
    }
    // Sort descending by date
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const deleteRecord = async (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    await deleteAttendanceRecordDb(id);
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await saveSettings(updated);
  };

  return {
    records,
    isLoaded: isLoaded && timetableLoaded,
    error,
    loadData,
    saveRecord,
    deleteRecord,
    getSubjectSummary,
    getTodaySessions,
    getRecordsByDate,
    getSubjectRecords,
    settings,
    updateSettings,
  };
};
