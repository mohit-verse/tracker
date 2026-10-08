import { Subject, TimetableEntry } from '../types';

export const MOCK_SUBJECTS: Subject[] = [
  { id: 'sub_1', name: 'C Programming Language', hasTheory: true, hasPractical: false },
  { id: 'sub_2', name: 'Python Programming', hasTheory: true, hasPractical: false },
  { id: 'sub_3', name: 'Strategic Communication Skills', hasTheory: true, hasPractical: false },
  { id: 'sub_4', name: 'Multi Disciplinary Course-1', hasTheory: true, hasPractical: false },
  { id: 'sub_5', name: 'Strategic Data Analytics and Collaborative Tools', hasTheory: true, hasPractical: true },
  { id: 'sub_6', name: 'Project Work - 1', hasTheory: false, hasPractical: true },
  { id: 'sub_7', name: 'C Programming Language Lab', hasTheory: false, hasPractical: true },
  { id: 'sub_8', name: 'Python Programming Lab', hasTheory: false, hasPractical: true },
];

export const MOCK_TIMETABLE: TimetableEntry[] = [
  {
    id: 'tt_1',
    dayOfWeek: 3, // Wednesday
    startTime: '10:00',
    endTime: '11:00',
    subjectId: 'sub_2', // Python Programming Theory
    component: 'theory',
    isAttendanceBearing: true,
    weight: 1,
  },
  {
    id: 'tt_2',
    dayOfWeek: 3,
    startTime: '11:00',
    endTime: '13:00',
    subjectId: 'sub_8', // Python Programming Lab
    component: 'practical',
    isAttendanceBearing: true,
    weight: 1,
    batchConstraint: 'Batch I',
  },
  {
    id: 'tt_3',
    dayOfWeek: 4, // Thursday
    startTime: '10:00',
    endTime: '12:00',
    subjectId: 'sub_7', // C Programming Lab
    component: 'practical',
    isAttendanceBearing: true,
    weight: 1, // weight 1 despite 2 hours
  },
  {
    id: 'tt_4',
    dayOfWeek: 4,
    startTime: '12:00',
    endTime: '14:00',
    subjectId: 'sub_5', // Strategic Data Analytics
    component: 'practical',
    isAttendanceBearing: true,
    weight: 1, // weight 1 despite 2 hours
  },
  {
    id: 'tt_5',
    dayOfWeek: 4,
    startTime: '14:00',
    endTime: '16:00',
    subjectId: 'sub_6', // Project Work-1
    component: 'practical', // or none, but it's practical
    isAttendanceBearing: true,
    weight: 2, // Project work weight is 2
  },
  {
    id: 'tt_6',
    dayOfWeek: 5, // Friday
    startTime: '15:00',
    endTime: '16:00',
    subjectId: 'sports',
    component: 'none',
    isAttendanceBearing: false,
    weight: 0,
    displayName: 'Sports'
  },
  {
    id: 'tt_7',
    dayOfWeek: 5,
    startTime: '16:00',
    endTime: '17:00',
    subjectId: 'library',
    component: 'none',
    isAttendanceBearing: false,
    weight: 0,
    displayName: 'Library'
  }
];
