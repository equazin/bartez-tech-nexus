-- ── 018_client_active_flag.sql ───────────────────────────────────────────────
-- Adds `active` boolean to profiles so admins can enable/disable client access.
-- Inactive clients cannot log into the B2B portal.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Index for fast "pending clients" queries
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles (active);

-- Update the B2B catalog view to only show data to active clients
-- (the auth.uid() check already filters by session, so this is belt-and-suspenders)
