-- ==============================================================================
-- TRACKER — COMPLETE CONSOLIDATED SUPABASE SCHEMA & MIGRATIONS
-- File: supabase/migrations/ALL_MIGRATIONS_COMBINED.sql
-- Run this script in: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Safe & Idempotent: Can be run on fresh or existing databases without data loss.
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Deleted Records (Tombstones for Sync)
CREATE TABLE IF NOT EXISTS public.deleted_records (
    id TEXT NOT NULL,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    PRIMARY KEY (id, user_id, table_name)
);
ALTER TABLE public.deleted_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own deleted records" ON public.deleted_records;
CREATE POLICY "Users can manage their own deleted records" ON public.deleted_records
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Semesters
CREATE TABLE IF NOT EXISTS public.semesters (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own semesters" ON public.semesters;
CREATE POLICY "Users can manage their own semesters" ON public.semesters
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Subjects
CREATE TABLE IF NOT EXISTS public.subjects (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    has_theory BOOLEAN DEFAULT false,
    has_practical BOOLEAN DEFAULT false,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own subjects" ON public.subjects;
CREATE POLICY "Users can manage their own subjects" ON public.subjects
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Timetable Rules
CREATE TABLE IF NOT EXISTS public.timetable_rules (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    component TEXT NOT NULL,
    is_attendance_bearing BOOLEAN DEFAULT false,
    weight REAL DEFAULT 1,
    batch_constraint TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
ALTER TABLE public.timetable_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own timetable rules" ON public.timetable_rules;
CREATE POLICY "Users can manage their own timetable rules" ON public.timetable_rules
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. Class Sessions
CREATE TABLE IF NOT EXISTS public.class_sessions (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    timetable_rule_id TEXT,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    component TEXT NOT NULL,
    weight REAL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own class sessions" ON public.class_sessions;
CREATE POLICY "Users can manage their own class sessions" ON public.class_sessions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Attendance Records
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE UNIQUE,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own attendance records" ON public.attendance_records;
CREATE POLICY "Users can manage their own attendance records" ON public.attendance_records
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Recurring Week Off Days
CREATE TABLE IF NOT EXISTS public.week_off_days (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, semester_id, day_of_week)
);
ALTER TABLE public.week_off_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own week_off_days" ON public.week_off_days;
CREATE POLICY "Users can manage their own week_off_days" ON public.week_off_days
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 9. Date-Specific Holidays
CREATE TABLE IF NOT EXISTS public.holidays (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, date)
);
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own holidays" ON public.holidays;
CREATE POLICY "Users can manage their own holidays" ON public.holidays
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 10. Attendance Baselines (Historical Previous Attendance)
CREATE TABLE IF NOT EXISTS public.attendance_baselines (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_id TEXT NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    component TEXT NOT NULL,
    attended INTEGER NOT NULL DEFAULT 0,
    conducted INTEGER NOT NULL DEFAULT 0,
    attended_weight INTEGER NOT NULL DEFAULT 0,
    conducted_weight INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, subject_id, component)
);
ALTER TABLE public.attendance_baselines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own attendance baselines" ON public.attendance_baselines;
CREATE POLICY "Users can manage their own attendance baselines" ON public.attendance_baselines
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Column safety check if table existed previously
ALTER TABLE IF EXISTS public.attendance_baselines ADD COLUMN IF NOT EXISTS attended INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS public.attendance_baselines ADD COLUMN IF NOT EXISTS conducted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS public.attendance_baselines ADD COLUMN IF NOT EXISTS attended_weight INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS public.attendance_baselines ADD COLUMN IF NOT EXISTS conducted_weight INTEGER NOT NULL DEFAULT 0;

-- 11. User Preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
    key TEXT NOT NULL,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (key, user_id)
);
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.user_preferences;
CREATE POLICY "Users can manage their own preferences" ON public.user_preferences
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 12. Habits
CREATE TABLE IF NOT EXISTS public.habits (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    frequency_type TEXT NOT NULL,
    target_count INTEGER NOT NULL DEFAULT 1,
    start_date TEXT NOT NULL,
    reminder_time TEXT,
    reminder_enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own habits" ON public.habits;
CREATE POLICY "Users can manage their own habits" ON public.habits
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 13. Habit Entries
CREATE TABLE IF NOT EXISTS public.habit_entries (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    habit_id TEXT NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(habit_id, date, user_id)
);
ALTER TABLE public.habit_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own habit entries" ON public.habit_entries;
CREATE POLICY "Users can manage their own habit entries" ON public.habit_entries
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 14. Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.class_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON public.attendance_records(user_id, status);
CREATE INDEX IF NOT EXISTS idx_timetable_day ON public.timetable_rules(user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_holidays_user_date ON public.holidays(user_id, date);
CREATE INDEX IF NOT EXISTS idx_week_off_days_user_sem ON public.week_off_days(user_id, semester_id);

-- 15. Atomic Sync Upsert RPC
CREATE OR REPLACE FUNCTION public.sync_upsert(
    p_table_name TEXT,
    p_payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_id TEXT;
    v_server_updated_at TIMESTAMP WITH TIME ZONE;
    v_client_updated_at TIMESTAMP WITH TIME ZONE;
    v_query TEXT;
    v_result JSONB;
    v_pk_col TEXT := 'id';
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF p_table_name NOT IN (
        'semesters', 'subjects', 'timetable_rules', 'class_sessions',
        'attendance_records', 'user_preferences', 'habits', 'habit_entries',
        'deleted_records', 'holidays', 'attendance_baselines', 'week_off_days'
    ) THEN
        RAISE EXCEPTION 'Invalid table name: %', p_table_name;
    END IF;

    IF p_table_name = 'user_preferences' THEN
        v_pk_col := 'key';
    END IF;

    v_id := p_payload->>v_pk_col;
    
    IF p_table_name = 'deleted_records' THEN
        v_client_updated_at := (p_payload->>'deleted_at')::TIMESTAMP WITH TIME ZONE;
    ELSE
        v_client_updated_at := (p_payload->>'updated_at')::TIMESTAMP WITH TIME ZONE;
    END IF;

    IF v_client_updated_at IS NULL THEN
        v_client_updated_at := now();
    END IF;

    -- Lock the row and get the current timestamp
    v_query := format('SELECT %I FROM %I WHERE %I = $1 AND user_id = $2 FOR UPDATE', 
                      CASE WHEN p_table_name = 'deleted_records' THEN 'deleted_at' ELSE 'updated_at' END,
                      p_table_name, v_pk_col);
    EXECUTE v_query INTO v_server_updated_at USING v_id, v_user_id;

    -- If this is an insert/update, ensure it hasn't been deleted by a newer tombstone
    IF p_table_name != 'deleted_records' THEN
        DECLARE
            v_tombstone_at TIMESTAMP WITH TIME ZONE;
        BEGIN
            EXECUTE 'SELECT deleted_at FROM deleted_records WHERE id = $1 AND table_name = $2 AND user_id = $3 FOR UPDATE'
            INTO v_tombstone_at USING v_id, p_table_name, v_user_id;

            IF v_tombstone_at IS NOT NULL AND v_tombstone_at > v_client_updated_at THEN
                RETURN jsonb_build_object(
                    'status', 'conflict', 
                    'data', jsonb_build_object('id', v_id, 'is_deleted', true)
                );
            END IF;
        END;
    END IF;

    IF v_server_updated_at IS NOT NULL AND v_server_updated_at > v_client_updated_at THEN
        EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE %I = $1 AND user_id = $2', p_table_name, v_pk_col)
        INTO v_result USING v_id, v_user_id;
        
        RETURN jsonb_build_object('status', 'conflict', 'data', v_result);
    END IF;

    -- Safe to Upsert: inject authenticated user_id
    p_payload := p_payload || jsonb_build_object('user_id', v_user_id);

    DECLARE
        v_set_clause TEXT;
    BEGIN
        SELECT string_agg(format('%I = EXCLUDED.%I', key, key), ', ')
        INTO v_set_clause
        FROM jsonb_object_keys(p_payload) AS key
        WHERE key != v_pk_col AND key != 'user_id';

        IF v_set_clause IS NULL THEN
            v_query := format('INSERT INTO %I SELECT * FROM jsonb_populate_record(null::%I, $1) ON CONFLICT ON CONSTRAINT %I DO NOTHING', 
                p_table_name, p_table_name, p_table_name || '_pkey');
        ELSE
            v_query := format(
                'INSERT INTO %I SELECT * FROM jsonb_populate_record(null::%I, $1) ' ||
                'ON CONFLICT ON CONSTRAINT %I DO UPDATE SET %s',
                p_table_name, p_table_name, p_table_name || '_pkey',
                v_set_clause
            );
        END IF;
    END;

    EXECUTE v_query USING p_payload;

    -- Return the upserted row
    EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE %I = $1 AND user_id = $2', p_table_name, v_pk_col)
    INTO v_result USING v_id, v_user_id;

    RETURN jsonb_build_object('status', 'success', 'data', v_result);
END;
$$;

-- 16. Secure Account Deletion RPC
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.semesters WHERE user_id = v_user_id;
  DELETE FROM public.subjects WHERE user_id = v_user_id;
  DELETE FROM public.timetable_rules WHERE user_id = v_user_id;
  DELETE FROM public.class_sessions WHERE user_id = v_user_id;
  DELETE FROM public.user_preferences WHERE user_id = v_user_id;
  DELETE FROM public.habits WHERE user_id = v_user_id;
  DELETE FROM public.habit_entries WHERE user_id = v_user_id;
  DELETE FROM public.deleted_records WHERE user_id = v_user_id;
  DELETE FROM public.holidays WHERE user_id = v_user_id;
  DELETE FROM public.attendance_baselines WHERE user_id = v_user_id;
  DELETE FROM public.attendance_records WHERE user_id = v_user_id;
  DELETE FROM public.week_off_days WHERE user_id = v_user_id;

  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
