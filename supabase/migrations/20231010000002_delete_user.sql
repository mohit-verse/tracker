-- Migration: 20231010000002_delete_user.sql
-- Description: Adds a securely scoped RPC to allow users to delete their own account and all associated records.

-- Drop if exists
DROP FUNCTION IF EXISTS public.delete_user_account();

-- Function to delete the calling user's account from auth.users.
-- It requires SECURITY DEFINER to bypass the normal restriction that users cannot delete themselves from auth.users.
-- Since it uses SECURITY DEFINER, we MUST strictly verify the caller is not anonymous and target only their specific auth.uid().
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the ID of the currently authenticated user
  v_user_id := auth.uid();

  -- Safety check: ensure a user is actually logged in
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- The foreign key relationships from public tables to auth.users (if configured correctly) 
  -- will automatically cascade and delete the user's data in the public schema.
  -- Alternatively, since we use `owner_id = auth.uid()` in RLS policies without foreign keys to auth.users,
  -- we should explicitly delete from public tables to ensure cleanliness if ON DELETE CASCADE is missing.
  
  DELETE FROM public.semesters WHERE owner_id = v_user_id;
  DELETE FROM public.subjects WHERE owner_id = v_user_id;
  DELETE FROM public.timetable_rules WHERE owner_id = v_user_id;
  DELETE FROM public.class_sessions WHERE owner_id = v_user_id;
  DELETE FROM public.user_preferences WHERE owner_id = v_user_id;
  DELETE FROM public.habits WHERE owner_id = v_user_id;
  DELETE FROM public.habit_entries WHERE owner_id = v_user_id;
  DELETE FROM public.deleted_records WHERE owner_id = v_user_id;

  -- Finally, delete the user from the Supabase auth schema.
  -- This removes their identity and revokes their active sessions.
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Ensure it cannot be executed by the anon role.
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
