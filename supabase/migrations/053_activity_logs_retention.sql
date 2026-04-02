-- ── 053_activity_logs_retention.sql ─────────────────────────────────────────
-- activity_logs retention policy: archive rows older than 90 days into
-- activity_logs_archive, then delete from the hot table.
--
-- NOTE: PostgreSQL native declarative partitioning on an existing table requires
-- a full rebuild (CREATE TABLE new + copy + rename) which is risky in production.
-- Instead, we implement a lightweight archiving approach:
--   1. activity_logs_archive — cold storage table with same structure
--   2. archive_old_activity_logs() — function to move rows > 90 days
--   3. No partitioning risk to production data
--
-- To enable automated archiving, call archive_old_activity_logs() from a
-- Supabase cron job (pg_cron):
--   SELECT cron.schedule('archive-logs', '0 2 * * *', 'SELECT archive_old_activity_logs()');
--
-- Fully idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Archive table (mirrors activity_logs structure)
CREATE TABLE IF NOT EXISTS activity_logs_archive (
  id          BIGINT,
  user_id     UUID,
  action      TEXT,
  entity_type TEXT,
  entity_id   TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ,
  archived_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE activity_logs_archive IS
  'Cold-storage archive of activity_logs rows older than 90 days.';

-- Indexes on archive for querying
CREATE INDEX IF NOT EXISTS idx_activity_logs_archive_user
  ON activity_logs_archive(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_archive_created
  ON activity_logs_archive(created_at DESC);

-- 2. Archive function
CREATE OR REPLACE FUNCTION archive_old_activity_logs(
  p_retention_days INT DEFAULT 90
)
RETURNS INT  -- rows archived
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cutoff    TIMESTAMPTZ := now() - (p_retention_days || ' days')::INTERVAL;
  v_archived  INT;
BEGIN
  -- Insert old rows into archive
  WITH moved AS (
    DELETE FROM activity_logs
     WHERE created_at < v_cutoff
    RETURNING id, user_id, action, entity_type, entity_id, metadata, created_at
  )
  INSERT INTO activity_logs_archive (id, user_id, action, entity_type, entity_id, metadata, created_at)
  SELECT id, user_id, action, entity_type, entity_id, metadata, created_at
    FROM moved;

  GET DIAGNOSTICS v_archived = ROW_COUNT;

  RETURN v_archived;
END;
$$;

COMMENT ON FUNCTION archive_old_activity_logs IS
  'Moves activity_logs rows older than p_retention_days (default 90) to activity_logs_archive. '
  'Call daily via pg_cron for automated retention management.';

-- 3. Index on hot table (if missing) to make the DELETE fast
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON activity_logs(created_at DESC);

-- 4. View: unified activity log (hot + archive)
CREATE OR REPLACE VIEW activity_logs_all AS
  SELECT id, user_id, action, entity_type, entity_id, metadata, created_at, false AS archived
    FROM activity_logs
  UNION ALL
  SELECT id, user_id, action, entity_type, entity_id, metadata, created_at, true AS archived
    FROM activity_logs_archive;

COMMENT ON VIEW activity_logs_all IS
  'Unified view of current and archived activity logs. Use activity_logs for recent data.';

-- 5. RLS on archive table — admin only
ALTER TABLE activity_logs_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_activity_logs_archive_select" ON activity_logs_archive;

CREATE POLICY "admin_activity_logs_archive_select"
  ON activity_logs_archive FOR SELECT TO authenticated
  USING (get_my_role() = 'admin');
