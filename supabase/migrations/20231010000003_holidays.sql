-- Migration: 20231010000003_holidays.sql
-- Description: Adds holidays table with RLS policies and indexes

CREATE TABLE IF NOT EXISTS public.holidays (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- YYYY-MM-DD
    name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, date)
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own holidays" ON public.holidays;
CREATE POLICY "Users can manage their own holidays" ON public.holidays
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_holidays_user_date ON public.holidays(user_id, date);
