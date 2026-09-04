-- Resolve Supabase security lints
-- Migration: 2026-09-04

-- ====================
-- 1. active_expenses view ran with the owner's (postgres) privileges, exposing
--    every group's expenses through PostgREST without RLS. Unused by the app.
-- ====================
DROP VIEW IF EXISTS public.active_expenses;

-- ====================
-- 2. Remove stale 6-arg overload; the 7-arg version has a default for
--    p_exchange_rate, so keeping both makes 6-arg calls ambiguous.
-- ====================
DROP FUNCTION IF EXISTS public.update_expense_details(uuid, uuid, numeric, text, text, jsonb);

-- ====================
-- 3. Pin search_path on every SECURITY DEFINER function so a malicious object
--    in a caller-controlled schema cannot be resolved ahead of public.
-- ====================
ALTER FUNCTION public.archive_group(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.create_group(text, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.delete_group(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_group_by_invite_code(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.hide_group(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_activity(uuid, text, text, uuid, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.permanent_delete_expense(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.restore_expense(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.restore_group(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.settle_debt_rpc(uuid, uuid, uuid, numeric, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.settle_group_expenses(uuid, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION public.unarchive_group(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.undo_settlement(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.unhide_group(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_expense_details(uuid, uuid, numeric, text, text, jsonb, numeric) SET search_path = public, pg_temp;
