/**
 * Pure domain rules for Tracker onboarding, setup lifecycle, and root navigation state machine.
 */

export interface SemesterPrerequisite {
  id?: string | null;
  name?: string | null;
  start_date?: string | null;
}

export interface SetupPrerequisites {
  metadataSetupCompleted?: boolean | string | null;
  activeSemester?: SemesterPrerequisite | null;
  subjectsCount: number;
  timetableRulesCount: number;
}

export interface NavigationState {
  loading: boolean;
  ownerError: string | null;
  session: any | null;
  isConfigured: boolean;
  hasSetup: boolean;
  currentSegment: string; // 'auth' | 'setup' | '(tabs)' | 'subject' | etc.
}

/**
 * Validates whether the setup prerequisites are fulfilled.
 * Returns true if explicit flag is set or all mandatory entities exist.
 */
export function isSetupComplete(prereqs: SetupPrerequisites): boolean {
  if (prereqs.metadataSetupCompleted === true || prereqs.metadataSetupCompleted === '1') {
    return true;
  }

  const sem = prereqs.activeSemester;
  const hasValidSemester = Boolean(
    sem &&
    sem.id &&
    typeof sem.name === 'string' &&
    sem.name.trim().length > 0 &&
    typeof sem.start_date === 'string' &&
    sem.start_date.trim().length > 0
  );

  return hasValidSemester && prereqs.subjectsCount > 0 && prereqs.timetableRulesCount > 0;
}

/**
 * Calculates which step of the onboarding wizard to resume:
 * Step 0: Welcome / Start
 * Step 1: Semester Details (if active semester is missing)
 * Step 2: Add Subjects (if semester exists but 0 subjects)
 * Step 3: Configure Timetable (if semester & subjects exist, but 0 timetable slots)
 * Step 4: Review & Finish (if all required components exist)
 */
export function determineResumeStep(
  hasActiveSemester: boolean,
  subjectsCount: number,
  timetableCount: number
): number {
  if (!hasActiveSemester) return 0;
  if (subjectsCount === 0) return 2;
  if (timetableCount === 0) return 3;
  return 4;
}

/**
 * Pure state machine router for _layout.tsx.
 * Returns target route if redirect is required, or null if current route is valid.
 */
export function resolveNavigationRoute(state: NavigationState): string | null {
  if (state.loading) return null;

  const inAuthGroup = state.currentSegment === 'auth';
  const isSetup = state.currentSegment === 'setup';

  // 1. Ownership conflict check: route to auth to resolve or wipe
  if (state.ownerError && !inAuthGroup) {
    return '/auth';
  }

  // 2. Authentication required when Supabase is configured
  if (!state.session && !inAuthGroup && state.isConfigured) {
    return '/auth';
  }

  // 3. Initial setup required (authenticated or unconfigured, setup not completed)
  if ((state.session || !state.isConfigured) && !state.hasSetup && !isSetup) {
    return '/setup';
  }

  // 4. Setup completed: redirect away from auth or setup into main tabs
  if ((state.session || !state.isConfigured) && state.hasSetup && (inAuthGroup || isSetup)) {
    return '/(tabs)';
  }

  // Current route is legitimate
  return null;
}

/**
 * Validates semester input fields.
 */
export function validateSemesterInput(name: string, startDate: string): { valid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { valid: false, error: 'Please enter a semester name.' };
  }
  if (!startDate || !startDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(startDate.trim())) {
    return { valid: false, error: 'Please enter a valid start date (YYYY-MM-DD).' };
  }
  return { valid: true };
}

/**
 * Validates timetable slot inputs.
 */
export function validateTimetableSlotInput(params: {
  subjectId: string;
  startTime: string;
  endTime: string;
  weight: number;
}): { valid: boolean; error?: string } {
  if (!params.subjectId || !params.subjectId.trim()) {
    return { valid: false, error: 'Please select a subject for this slot.' };
  }
  if (!params.startTime || !params.endTime || params.startTime >= params.endTime) {
    return { valid: false, error: 'End time must be after start time.' };
  }
  if (isNaN(params.weight) || params.weight < 0) {
    return { valid: false, error: 'Weight must be a positive number.' };
  }
  return { valid: true };
}
