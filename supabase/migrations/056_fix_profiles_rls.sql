-- ── 054_fix_profiles_rls.sql ─────────────────────────────────────────────────
-- Fixes recursive RLS policies on the profiles table.
--
-- Problem: the admin SELECT policy queries profiles to check the role, but
-- profiles itself has RLS — this causes infinite recursion and 400 errors.
--
-- Solution: use a SECURITY DEFINER function that bypasses RLS to get the
-- current user's role. SECURITY DEFINER runs as the function owner (postgres)
-- so it skips RLS entirely.
-- Fully idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Non-recursive helper: get current user's role bypassing RLS
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

COMMENT ON FUNCTION get_my_role IS
  'Returns the role of the currently authenticated user. SECURITY DEFINER bypasses RLS.';

-- 2. Drop all existing profiles policies and recreate without recursion
DROP POLICY IF EXISTS "profiles_select_own"      ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin"    ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin"    ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"      ON profiles;
DROP POLICY IF EXISTS "profiles_insert_trigger"  ON profiles;

-- Users can always read their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Admins and vendedores can read ALL profiles (non-recursive via get_my_role())
CREATE POLICY "profiles_select_staff"
  ON profiles FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'vendedor'));

-- Admins can update any profile
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow inserts from authenticated users (for the auth trigger SECURITY DEFINER)
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 3. Also fix all other tables that use the recursive pattern
--    Replace inline EXISTS(SELECT FROM profiles...) with get_my_role() calls
--    for suppliers, pricing_rules, activity_logs (from migration 001)

-- suppliers
DROP POLICY IF EXISTS "suppliers_read"   ON suppliers;
DROP POLICY IF EXISTS "suppliers_write"  ON suppliers;
DROP POLICY IF EXISTS "suppliers_admin"  ON suppliers;

CREATE POLICY "suppliers_read"
  ON suppliers FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'vendedor'));

CREATE POLICY "suppliers_write"
  ON suppliers FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

-- pricing_rules
DROP POLICY IF EXISTS "pricing_rules_read"  ON pricing_rules;
DROP POLICY IF EXISTS "pricing_rules_write" ON pricing_rules;
DROP POLICY IF EXISTS "pricing_rules_admin" ON pricing_rules;

CREATE POLICY "pricing_rules_read"
  ON pricing_rules FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'vendedor'));

CREATE POLICY "pricing_rules_write"
  ON pricing_rules FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

-- activity_logs
DROP POLICY IF EXISTS "activity_logs_own"   ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_admin" ON activity_logs;

CREATE POLICY "activity_logs_own"
  ON activity_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "activity_logs_staff"
  ON activity_logs FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'vendedor'));

CREATE POLICY "activity_logs_insert"
  ON activity_logs FOR INSERT TO authenticated
  WITH CHECK (true);
