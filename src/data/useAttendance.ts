import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AttendanceRecord, AttendanceSummary, Subject, AppSettings, TimetableEntry } from '../types';
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
  getAttendanceBaselines,
  saveAttendanceBaseline,
  getActiveSemester,
  getSemesters,
  setActiveSemester as dbSetActiveSemester,
  createSemester as dbCreateSemester
} from '../db/repositories';
import { getLocalDateString } from '../utils/dateUtils';
import { formatSubjectDisplayName, isSubjectMatch } from '../utils/subjectUtils';

export interface OverallAttendanceSummary {
  attended: number;
  conducted: number;
  percentage: number | null;
  isAboveTarget: boolean | null;
  theoryAttended: number;
  theoryConducted: number;
  theoryPercentage: number | null;
  practicalAttended: number;
  practicalConducted: number;
  practicalPercentage: number | null;
  atRiskComponents: string[];
}

export interface AttendanceContextType {
  records: AttendanceRecord[];
  subjects: Subject[];
  holidays: { id: string; date: string; name?: string }[];
  baselines: any[];
  settings: AppSettings;
  timetable: TimetableEntry[];
  activeSemester: { id: string; name: string; start_date: string; end_date?: string } | null;
  semesters: any[];
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
  saveBaseline: (
    subjectId: string,
    component: 'theory' | 'practical',
    attended: number,
    conducted: number
  ) => Promise<void>;
  getSubjectBaselines: (subjectId: string) => {
    theory?: { attended: number; conducted: number };
    practical?: { attended: number; conducted: number };
  };
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
  switchSemester: (semesterId: string) => Promise<void>;
  createNewSemester: (name: string, startDate: string, endDate?: string) => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | null>(null);

export const AttendanceProvider = ({ children }: { children: ReactNode }) => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [holidays, setHolidays] = useState<{ id: string; date: string; name?: string }[]>([]);
  const [baselines, setBaselines] = useState<any[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ studentBatch: 'Batch I', targetPercentage: 0.75 });
  const [activeSemester, setActiveSemesterState] = useState<{ id: string; name: string; start_date: string; end_date?: string } | null>(null);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { timetable, isLoaded: timetableLoaded, loadTimetable } = useTimetable();

  const loadData = useCallback(async () => {
    try {
      setError(null);
      await getDatabase();
      const [savedRecords, savedSubjects, savedHolidays, savedBaselines, savedSettings, activeSem, allSems] = await Promise.all([
        getAttendanceRecords(),
        dbGetSubjects(),
        dbGetHolidays(),
        getAttendanceBaselines(),
        getSettings(),
        getActiveSemester(),
        getSemesters(),
      ]);

      setRecords(savedRecords || []);
      setSubjects(savedSubjects || []);
      setHolidays(savedHolidays || []);
      setBaselines(savedBaselines || []);
      if (savedSettings) {
        setSettings(savedSettings);
      }
      setActiveSemesterState(activeSem || null);
      setSemesters(allSems || []);
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
    const todayStr = getLocalDateString(new Date());
    if (date > todayStr) {
      throw new Error('Future attendance cannot be marked');
    }

    const now = new Date().toISOString();
    const matchedSub = subjects.find(
      s => s.id === subjectId || s.name.toLowerCase() === subjectId.toLowerCase()
    );
    const resolvedSubjectId = matchedSub ? matchedSub.id : subjectId;

    const existingIndex = records.findIndex(
      r => r.date === date && r.timetableEntryId === timetableEntryId
    );

    let updatedRecords: AttendanceRecord[];
    if (existingIndex >= 0) {
      const existing = records[existingIndex];
      const updatedItem: AttendanceRecord = {
        ...existing,
        subjectId: resolvedSubjectId,
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
        subjectId: resolvedSubjectId,
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
          subjectName: formatSubjectDisplayName({ subjectId: sub.id, subjects }),
          summary: calculateAttendance(
            updatedRecords.filter(r => isSubjectMatch(r.subjectId, sub.id, subjects)),
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

  const saveBaseline = async (
    subjectId: string,
    component: 'theory' | 'practical',
    attended: number,
    conducted: number
  ) => {
    const matchedSub = subjects.find(
      s => s.id === subjectId || s.name.toLowerCase() === subjectId.toLowerCase()
    );
    const resolvedSubjectId = matchedSub ? matchedSub.id : subjectId;

    await saveAttendanceBaseline({
      subjectId: resolvedSubjectId,
      component,
      attendedWeight: attended,
      conductedWeight: conducted,
    });
    const [updatedBaselines, updatedSubjects] = await Promise.all([
      getAttendanceBaselines(),
      dbGetSubjects(),
    ]);
    setBaselines(updatedBaselines || []);
    setSubjects(updatedSubjects || []);
    triggerBackgroundSync();
  };

  const getSubjectBaselines = useCallback((subjectId: string) => {
    const theory = baselines.find(b => isSubjectMatch(b.subjectId, subjectId, subjects) && b.component === 'theory');
    const practical = baselines.find(b => isSubjectMatch(b.subjectId, subjectId, subjects) && b.component === 'practical');
    return {
      theory: theory ? { attended: theory.attendedWeight, conducted: theory.conductedWeight } : undefined,
      practical: practical ? { attended: practical.attendedWeight, conducted: practical.conductedWeight } : undefined,
    };
  }, [baselines, subjects]);

  const getSubjectSummary = useCallback((subjectId: string, component: 'theory' | 'practical'): AttendanceSummary => {
    const subjectRecords = records.filter(r => isSubjectMatch(r.subjectId, subjectId, subjects) && r.component === component);
    const baseline = baselines.find(b => isSubjectMatch(b.subjectId, subjectId, subjects) && b.component === component);
    return calculateAttendance(subjectRecords, settings.targetPercentage, baseline);
  }, [records, baselines, subjects, settings.targetPercentage]);

  const getOverallSummary = useCallback((): OverallAttendanceSummary => {
    let totalAttended = 0;
    let totalConducted = 0;
    let theoryAttended = 0;
    let theoryConducted = 0;
    let practicalAttended = 0;
    let practicalConducted = 0;
    const atRiskComponents: string[] = [];

    // Sum all marked records (non-none)
    for (const r of records) {
      if (r.component === 'theory') {
        theoryConducted += r.weight;
        if (r.status === 'present') theoryAttended += r.weight;
      } else if (r.component === 'practical') {
        practicalConducted += r.weight;
        if (r.status === 'present') practicalAttended += r.weight;
      }
      if (r.component !== 'none') {
        totalConducted += r.weight;
        if (r.status === 'present') totalAttended += r.weight;
      }
    }

    // Sum baselines
    for (const b of baselines) {
      const att = b.attendedWeight || 0;
      const cond = b.conductedWeight || 0;
      totalAttended += att;
      totalConducted += cond;
      if (b.component === 'theory') {
        theoryAttended += att;
        theoryConducted += cond;
      } else if (b.component === 'practical') {
        practicalAttended += att;
        practicalConducted += cond;
      }
    }

    // Check component-level risks for all subjects
    for (const sub of subjects) {
      const subName = formatSubjectDisplayName({ subjectId: sub.id, subjects });
      const theorySummary = getSubjectSummary(sub.id, 'theory');
      if (theorySummary.conductedWeight > 0 && theorySummary.percentage !== null && !theorySummary.isAboveTarget) {
        atRiskComponents.push(`${subName} (Theory: ${Math.round(theorySummary.percentage)}%)`);
      }
      const practicalSummary = getSubjectSummary(sub.id, 'practical');
      if (practicalSummary.conductedWeight > 0 && practicalSummary.percentage !== null && !practicalSummary.isAboveTarget) {
        atRiskComponents.push(`${subName} (Practical: ${Math.round(practicalSummary.percentage)}%)`);
      }
    }

    const percentage = totalConducted > 0 ? (totalAttended / totalConducted) * 100 : null;
    const isAboveTarget = percentage !== null ? percentage >= (settings.targetPercentage * 100) : null;
    const theoryPercentage = theoryConducted > 0 ? (theoryAttended / theoryConducted) * 100 : null;
    const practicalPercentage = practicalConducted > 0 ? (practicalAttended / practicalConducted) * 100 : null;

    return {
      attended: totalAttended,
      conducted: totalConducted,
      percentage,
      isAboveTarget,
      theoryAttended,
      theoryConducted,
      theoryPercentage,
      practicalAttended,
      practicalConducted,
      practicalPercentage,
      atRiskComponents,
    };
  }, [records, baselines, subjects, getSubjectSummary, settings.targetPercentage]);

  const isHoliday = useCallback((dateStr: string): boolean => {
    return holidays.some(h => h.date === dateStr);
  }, [holidays]);

  const getTodaySessions = (date: Date) => {
    const dateStr = getLocalDateString(date);
    const holidayActive = isHoliday(dateStr);
    return getApplicableSessions(date, timetable, settings.studentBatch, holidayActive);
  };

  const getRecordsByDate = (date: string) => {
    return records.filter(r => r.date === date);
  };

  const getSubjectRecords = useCallback((subjectId: string, componentFilter?: 'theory' | 'practical' | 'all') => {
    let filtered = records.filter(r => isSubjectMatch(r.subjectId, subjectId, subjects));
    if (componentFilter && componentFilter !== 'all') {
      filtered = filtered.filter(r => r.component === componentFilter);
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, subjects]);

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

  const switchSemester = async (semesterId: string) => {
    await dbSetActiveSemester(semesterId);
    await loadData();
    triggerBackgroundSync();
  };

  const createNewSemester = async (name: string, startDate: string, endDate?: string) => {
    await dbCreateSemester(name, startDate, endDate);
    await loadData();
    triggerBackgroundSync();
  };

  const value: AttendanceContextType = {
    records,
    subjects,
    holidays,
    baselines,
    settings,
    timetable,
    activeSemester,
    semesters,
    isLoaded: isLoaded && timetableLoaded,
    error,
    loadData,
    saveRecord,
    deleteRecord,
    saveBaseline,
    getSubjectBaselines,
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
    switchSemester,
    createNewSemester,
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
      activeSemester: null,
      semesters: [],
      isLoaded: true,
      error: null,
      loadData: async () => {},
      saveRecord: async () => {},
      deleteRecord: async () => {},
      saveBaseline: async () => {},
      getSubjectBaselines: () => ({}),
      getSubjectSummary: () => ({ attendedWeight: 0, conductedWeight: 0, percentage: null, targetPercentage: 0.75, isAboveTarget: null }),
      getOverallSummary: () => ({
        attended: 0,
        conducted: 0,
        percentage: null,
        isAboveTarget: null,
        theoryAttended: 0,
        theoryConducted: 0,
        theoryPercentage: null,
        practicalAttended: 0,
        practicalConducted: 0,
        practicalPercentage: null,
        atRiskComponents: [],
      }),
      getTodaySessions: () => [],
      getRecordsByDate: () => [],
      getSubjectRecords: () => [],
      markHoliday: async () => {},
      removeHoliday: async () => {},
      isHoliday: () => false,
      saveSubject: async () => {},
      deleteSubject: async () => {},
      updateSettings: async () => {},
      switchSemester: async () => {},
      createNewSemester: async () => {},
    };
  }
  return context;
};

