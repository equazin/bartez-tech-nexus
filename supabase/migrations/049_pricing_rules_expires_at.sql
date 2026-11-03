-- ── 047_pricing_rules_expires_at.sql ───────────────────────────────────────
-- Adds an optional expires_at column to pricing_rules so stale rules can be
-- identified and automatically excluded from price computation.
-- Fully idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add the column (nullable — existing rules stay active indefinitely)
ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL;

-- 2. Index to speed up active-rule queries
CREATE INDEX IF NOT EXISTS idx_pricing_rules_expires_at
  ON pricing_rules(expires_at)
  WHERE expires_at IS NOT NULL;

-- 3. Helper view: only currently-active rules
CREATE OR REPLACE VIEW active_pricing_rules AS
  SELECT *
    FROM pricing_rules
   WHERE expires_at IS NULL
      OR expires_at > now();

COMMENT ON COLUMN pricing_rules.expires_at IS
  'When set, the rule is ignored after this timestamp. NULL = never expires.';
