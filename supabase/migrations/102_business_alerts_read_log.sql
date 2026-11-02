-- ── 099_business_alerts_read_log.sql ─────────────────────────────────────────
-- Tracks which business_alerts each client has read/dismissed.
-- Also adds mv_client_kpis: a lightweight materialized view for the Home Dashboard.
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Read log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_alerts_read (
  alert_id    BIGINT  NOT NULL REFERENCES business_alerts(id) ON DELETE CASCADE,
  profile_id  UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (alert_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_ba_read_profile ON business_alerts_read(profile_id);

ALTER TABLE business_alerts_read ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ba_read_owner" ON business_alerts_read;
CREATE POLICY "ba_read_owner"
  ON business_alerts_read FOR ALL TO authenticated
  USING  (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON business_alerts_read TO authenticated;

-- Helper: mark an alert as read for the current user
CREATE OR REPLACE FUNCTION mark_alert_read(p_alert_id BIGINT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO business_alerts_read (alert_id, profile_id)
  VALUES (p_alert_id, auth.uid())
  ON CONFLICT DO NOTHING;
$$;
GRANT EXECUTE ON FUNCTION mark_alert_read(BIGINT) TO authenticated;

-- 2. KPIs materialized view ───────────────────────────────────────────────────
-- Refreshed every 5 minutes via pg_cron or Edge Function cron trigger.
DROP MATERIALIZED VIEW IF EXISTS mv_client_kpis;

CREATE MATERIALIZED VIEW mv_client_kpis AS
SELECT
  p.id                                                      AS client_id,

  -- Orders in progress (pending / approved / preparing / shipped / dispatched)
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.status IN ('pending','approved','preparing','shipped','dispatched')
  )::INT                                                    AS orders_in_progress,

  -- Quotes pending (draft / sent — not yet converted)
  COUNT(DISTINCT q.id) FILTER (
    WHERE q.status IN ('draft','sent')
  )::INT                                                    AS quotes_pending,

  -- Last invoice date
  MAX(inv.created_at)                                       AS last_invoice_at,

  -- Credit utilisation %: credit_used / credit_limit * 100
  CASE
    WHEN COALESCE(p.credit_limit, 0) > 0
    THEN ROUND((COALESCE(p.credit_used, 0)::NUMERIC / p.credit_limit) * 100, 1)
    ELSE 0
  END                                                       AS credit_used_pct

FROM profiles p
LEFT JOIN orders o
  ON o.client_id = p.id
LEFT JOIN quotes q
  ON q.client_id = p.id
LEFT JOIN invoices inv
  ON inv.client_id = p.id
WHERE p.role IN ('client', 'cliente')
  AND p.active = true
GROUP BY p.id, p.credit_limit, p.credit_used;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_client_kpis_client
  ON mv_client_kpis(client_id);

-- Refresh function (called by cron every 5 min)
CREATE OR REPLACE FUNCTION refresh_mv_client_kpis()
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_client_kpis;
$$;
GRANT EXECUTE ON FUNCTION refresh_mv_client_kpis() TO service_role;

-- Accessor for the portal (RLS-safe: only returns own row)
CREATE OR REPLACE FUNCTION get_my_kpis()
RETURNS TABLE(
  orders_in_progress INT,
  quotes_pending     INT,
  last_invoice_at    TIMESTAMPTZ,
  credit_used_pct    NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    orders_in_progress,
    quotes_pending,
    last_invoice_at,
    credit_used_pct
  FROM mv_client_kpis
  WHERE client_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION get_my_kpis() TO authenticated;
