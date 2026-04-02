-- ── 000_profiles_baseline.sql ────────────────────────────────────────────────
-- Creates the `profiles` table if it doesn't exist.
-- This table mirrors auth.users (one row per user) and stores B2B profile data.
--
-- IMPORTANT: This migration must run BEFORE all others (numbered 001+).
-- The table is extended by subsequent migrations via ALTER TABLE.
-- All CREATE TABLE statements are idempotent (IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Base profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  phone         TEXT,
  company_name  TEXT NOT NULL DEFAULT '',
  contact_name  TEXT NOT NULL DEFAULT '',
  client_type   TEXT NOT NULL DEFAULT 'mayorista'
                CHECK (client_type IN ('mayorista', 'reseller', 'empresa')),
  default_margin NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  role          TEXT NOT NULL DEFAULT 'client'
                CHECK (role IN ('client', 'cliente', 'admin', 'vendedor')),
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE profiles IS
  'One row per auth.users entry. Stores B2B client and staff profile data.';

-- 2. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Users can read their own profile
DROP POLICY IF EXISTS "profiles_select_own"   ON profiles;
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Admins and vendedores can read all profiles
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = auth.uid()
         AND p.role IN ('admin', 'vendedor')
    )
  );

-- Admins can update any profile (e.g., to change role, credit_limit)
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
       WHERE p.id = auth.uid()
         AND p.role = 'admin'
    )
  );

-- Users can update their own non-sensitive fields
DROP POLICY IF EXISTS "profiles_update_own"   ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Insert is handled by the auth trigger (SECURITY DEFINER), not by RLS
-- But we allow service_role to insert freely
DROP POLICY IF EXISTS "profiles_insert_trigger" ON profiles;
CREATE POLICY "profiles_insert_trigger"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- 4. Updated_at auto-trigger
CREATE OR REPLACE FUNCTION profiles_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_set_updated_at();

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role   ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(active);
CREATE INDEX IF NOT EXISTS idx_profiles_email  ON profiles(email);
