-- Migration: 20231010000005_week_off_days.sql
-- Description: Adds week_off_days table with RLS policies and indexes for recurring weekly offs

CREATE TABLE IF NOT EXISTS public.week_off_days (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    semester_id TEXT NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL, -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, semester_id, day_of_week)
);

ALTER TABLE public.week_off_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own week_off_days" ON public.week_off_days;
CREATE POLICY "Users can manage their own week_off_days" ON public.week_off_days
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_week_off_days_user_sem ON public.week_off_days(user_id, semester_id);
