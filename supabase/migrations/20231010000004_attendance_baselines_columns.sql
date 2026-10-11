-- Migration: 20231010000004_attendance_baselines_columns.sql
-- Description: Ensures attendance_baselines supports both attended/conducted and attended_weight/conducted_weight column naming conventions.

ALTER TABLE IF EXISTS public.attendance_baselines 
  ADD COLUMN IF NOT EXISTS attended INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.attendance_baselines 
  ADD COLUMN IF NOT EXISTS conducted INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.attendance_baselines 
  ADD COLUMN IF NOT EXISTS attended_weight INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.attendance_baselines 
  ADD COLUMN IF NOT EXISTS conducted_weight INTEGER NOT NULL DEFAULT 0;
