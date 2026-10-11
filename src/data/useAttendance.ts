import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AttendanceRecord, AttendanceSummary, BatchType, Subject, AppSettings, TimetableEntry } from '../types';
import { calculateAttendance, getApplicableSessions } from '../features/attendance/attendanceService';
import { useTimetable } from './useTimetable';
import { checkRiskAlerts } from '../features/notifications/notificationService';
import { triggerBackgroundSync } from '../sync/syncService';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { 
  getAttendanceRecords, 
  addAttendanceRecord as dbAddRecord, 
  updateAttendanceRecordDb, 
  deleteAttendanceRecordDb, 
  getSettings, 
  saveSettings,
  getSubjects as dbGetSubjects,
  saveSubject as dbSaveSubject,
  deleteSubject as dbDeleteSubject,
  getHolidays as dbGetHolidays,
  addHoliday as dbAddHoliday,
  deleteHoliday as dbDeleteHoliday,
  getAttendanceBaselines
} from '../db/repositories';

export interface OverallAttendanceSummary {
  attended: number;
  conducted: number;
  percentage: number | null;
  isAboveTarget: boolean | null;
  atRiskComponents: string[];
}

export interface AttendanceContextType {
  records: AttendanceRecord[];
  subjects: Subject[];
  holidays: { id: string; date: string; name?: string }[];
  baselines: any[];
  settings: AppSettings;
  timetable: TimetableEntry[];
  isLoaded: boolean;
  error: string | null;
  loadData: () => Promise<void>;
  saveRecord: (
    subjectId: string,
    component: 'theory' | 'practical' | 'none',
    date: string,
    timetableEntryId: string,
    status: 'present' | 'absent',
    weight: number
  ) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  getSubjectSummary: (subjectId: string, component: 'theory' | 'practical') => AttendanceSummary;
  getOverallSummary: () => OverallAttendanceSummary;
  getTodaySessions: (date: Date) => TimetableEntry[];
  getRecordsByDate: (date: string) => AttendanceRecord[];
  getSubjectRecords: (subjectId: string, componentFilter?: 'theory' | 'practical' | 'all') => AttendanceRecord[];
  markHoliday: (date: string, name?: string) => Promise<void>;
  removeHoliday: (date: string) => Promise<void>;
  isHoliday: (date: string) => boolean;
  saveSubject: (subject: Subject) => Promise<void>;
  deleteSubject: (subjectId: string) => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | null>(null);

export const AttendanceProvider = ({ children }: { children: ReactNode }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [holidays, setHolidays] = useState<{ id: string; date: string; name?: string }[]>([]);
  const [baselines, setBaselines] = useState<any[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ studentBatch: 'Batch I', targetPercentage: 0.75 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { timetable, isLoaded: timetableLoaded, loadTimetable } = useTimetable();

  const loadData = useCallback(async () => {
    try {
      setError(null);
      await getDatabase();
      const [savedRecords, savedSubjects, savedHolidays, savedBaselines, savedSettings] = await Promise.all([
        getAttendanceRecords(),
        dbGetSubjects(),
        dbGetHolidays(),
        getAttendanceBaselines(),
        getSettings(),
      ]);

      setRecords(savedRecords || []);
      setSubjects(savedSubjects || []);
      setHolidays(savedHolidays || []);
      setBaselines(savedBaselines || []);
      if (savedSettings) {
        setSettings(savedSettings);
      }
      await loadTimetable();
      setIsLoaded(true);
    } catch (e: any) {
      setError(e.message || 'Failed to load attendance storage');
      setIsLoaded(true);
    }
  }, [loadTimetable]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveRecord = async (
    subjectId: string,
    component: 'theory' | 'practical' | 'none',
    date: string,
    timetableEntryId: string,
    status: 'present' | 'absent',
    weight: number
  ) => {
    // Validate future date rejection
    const todayStr = new Date().toISOString().split('T')[0];
    if (date > todayStr) {
      throw new Error('Future attendance cannot be marked');
    }

    const now = new Date().toISOString();
    const existingIndex = records.findIndex(
      r => r.date === date && r.timetableEntryId === timetableEntryId
    );

    let updatedRecords: AttendanceRecord[];
    if (existingIndex >= 0) {
      const existing = records[existingIndex];
      const updatedItem: AttendanceRecord = {
        ...existing,
        status,
        weight,
        component,
        updatedAt: now,
      };
      updatedRecords = [...records];
      updatedRecords[existingIndex] = updatedItem;
      setRecords(updatedRecords);
      await updateAttendanceRecordDb(existing.id, updatedItem);
    } else {
      const newRecord: AttendanceRecord = {
        id: uuidv4(),
        subjectId,
        component,
        date,
        timetableEntryId,
        status,
        weight,
        createdAt: now,
        updatedAt: now,
      };
      updatedRecords = [...records, newRecord];
      setRecords(updatedRecords);
      await dbAddRecord(newRecord);
    }

    // Trigger background sync to Supabase safely
    triggerBackgroundSync();

    // Check risk alerts asynchronously
    if (settings.notificationSettings?.riskAlertsEnabled && subjects.length > 0) {
      setTimeout(() => {
        const summaries = subjects.map(sub => ({
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

  const deleteRecord = async (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    await deleteAttendanceRecordDb(id);
    triggerBackgroundSync();
  };

  const getSubjectSummary = useCallback((subjectId: string, component: 'theory' | 'practical'): AttendanceSummary => {
    const subjectRecords = records.filter(r => r.subjectId === subjectId && r.component === component);
    const baseline = baselines.find(b => b.subjectId === subjectId && b.component === component);
    return calculateAttendance(subjectRecords, settings.targetPercentage, baseline);
  }, [records, baselines, settings.targetPercentage]);

  const getOverallSummary = useCallback((): OverallAttendanceSummary => {
    let totalAttended = 0;
    let totalConducted = 0;
    const atRiskComponents: string[] = [];

    // Sum all marked records (non-none)
    for (const r of records) {
      if (r.component !== 'none') {
        totalConducted += r.weight;
        if (r.status === 'present') totalAttended += r.weight;
      }
    }

    // Sum baselines
    for (const b of baselines) {
      totalAttended += b.attendedWeight || 0;
      totalConducted += b.conductedWeight || 0;
    }

    // Check component-level risks for all subjects
    for (const sub of subjects) {
      if (sub.hasTheory) {
        const theorySummary = getSubjectSummary(sub.id, 'theory');
        if (theorySummary.percentage !== null && !theorySummary.isAboveTarget) {
          atRiskComponents.push(`${sub.name} (Theory: ${Math.round(theorySummary.percentage)}%)`);
        }
      }
      if (sub.hasPractical) {
        const practicalSummary = getSubjectSummary(sub.id, 'practical');
        if (practicalSummary.percentage !== null && !practicalSummary.isAboveTarget) {
          atRiskComponents.push(`${sub.name} (Practical: ${Math.round(practicalSummary.percentage)}%)`);
        }
      }
    }

    const percentage = totalConducted > 0 ? (totalAttended / totalConducted) * 100 : null;
    const isAboveTarget = percentage !== null ? percentage >= (settings.targetPercentage * 100) : null;

    return {
      attended: totalAttended,
      conducted: totalConducted,
      percentage,
      isAboveTarget,
      atRiskComponents,
    };
  }, [records, baselines, subjects, getSubjectSummary, settings.targetPercentage]);

  const isHoliday = useCallback((dateStr: string): boolean => {
    return holidays.some(h => h.date === dateStr);
  }, [holidays]);

  const getTodaySessions = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const holidayActive = isHoliday(dateStr);
    return getApplicableSessions(date, timetable, settings.studentBatch, holidayActive);
  };

  const getRecordsByDate = (date: string) => {
    return records.filter(r => r.date === date);
  };

  const getSubjectRecords = (subjectId: string, componentFilter?: 'theory' | 'practical' | 'all') => {
    let filtered = records.filter(r => r.subjectId === subjectId);
    if (componentFilter && componentFilter !== 'all') {
      filtered = filtered.filter(r => r.component === componentFilter);
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const markHoliday = async (date: string, name?: string) => {
    await dbAddHoliday(date, name);
    const updated = await dbGetHolidays();
    setHolidays(updated);
    triggerBackgroundSync();
  };

  const removeHoliday = async (date: string) => {
    await dbDeleteHoliday(date);
    const updated = await dbGetHolidays();
    setHolidays(updated);
    triggerBackgroundSync();
  };

  const saveSubject = async (subject: Subject) => {
    await dbSaveSubject(subject);
    const updated = await dbGetSubjects();
    setSubjects(updated);
    triggerBackgroundSync();
  };

  const deleteSubject = async (subjectId: string) => {
    await dbDeleteSubject(subjectId);
    const updated = await dbGetSubjects();
    setSubjects(updated);
    triggerBackgroundSync();
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await saveSettings(updated);
  };

  const value: AttendanceContextType = {
    records,
    subjects,
    holidays,
    baselines,
    settings,
    timetable,
    isLoaded: isLoaded && timetableLoaded,
    error,
    loadData,
    saveRecord,
    deleteRecord,
    getSubjectSummary,
    getOverallSummary,
    getTodaySessions,
    getRecordsByDate,
    getSubjectRecords,
    markHoliday,
    removeHoliday,
    isHoliday,
    saveSubject,
    deleteSubject,
    updateSettings,
  };

  return React.createElement(AttendanceContext.Provider, { value }, children);
};

export const useAttendance = (): AttendanceContextType => {
  const context = useContext(AttendanceContext);
  if (!context) {
    // Fallback for standalone/unwrapped calls (e.g. tests or early boots)
    return {
      records: [],
      subjects: [],
      holidays: [],
      baselines: [],
      settings: { studentBatch: 'Batch I', targetPercentage: 0.75 },
      timetable: [],
      isLoaded: true,
      error: null,
      loadData: async () => {},
      saveRecord: async () => {},
      deleteRecord: async () => {},
      getSubjectSummary: () => ({ attendedWeight: 0, conductedWeight: 0, percentage: null, targetPercentage: 0.75, isAboveTarget: null }),
      getOverallSummary: () => ({ attended: 0, conducted: 0, percentage: null, isAboveTarget: null, atRiskComponents: [] }),
      getTodaySessions: () => [],
      getRecordsByDate: () => [],
      getSubjectRecords: () => [],
      markHoliday: async () => {},
      removeHoliday: async () => {},
      isHoliday: () => false,
      saveSubject: async () => {},
      deleteSubject: async () => {},
      updateSettings: async () => {},
    };
  }
  return context;
};
