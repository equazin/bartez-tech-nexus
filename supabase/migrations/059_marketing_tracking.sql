-- ============================================================
-- 057: Marketing Tracking — eventos de funnel B2B
-- ============================================================

-- ── marketing_events ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketing_events (
  id           BIGSERIAL PRIMARY KEY,
  event_id     UUID        NOT NULL DEFAULT gen_random_uuid(), -- deduplicación
  event_type   TEXT        NOT NULL,
  -- valores: page_view | landing_empresas_view | cta_click |
  --          registration_start | registration_complete |
  --          account_approved | portal_first_login | first_order | order_placed

  user_id      UUID        REFERENCES auth.users ON DELETE SET NULL,
  session_id   TEXT        NOT NULL,
  page         TEXT,

  -- UTM Attribution (last-touch al momento del evento)
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  utm_term     TEXT,
  utm_content  TEXT,

  -- Metadata adicional (total, productos, company, etc.)
  metadata     JSONB       NOT NULL DEFAULT '{}',

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT marketing_events_event_id_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_events_type_date
  ON marketing_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_events_campaign
  ON marketing_events (utm_campaign, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_events_user
  ON marketing_events (user_id);

CREATE INDEX IF NOT EXISTS idx_marketing_events_session
  ON marketing_events (session_id);

-- ── lead_sources ─────────────────────────────────────────────
-- Una fila por usuario — first-touch + last-touch + history
CREATE TABLE IF NOT EXISTS lead_sources (
  user_id      UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,

  -- First touch (nunca se pisa)
  first_touch_source   TEXT,
  first_touch_medium   TEXT,
  first_touch_campaign TEXT,
  first_touch_term     TEXT,
  first_touch_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_landing_page   TEXT,

  -- Last touch (al momento del registro)
  last_touch_source    TEXT,
  last_touch_medium    TEXT,
  last_touch_campaign  TEXT,
  last_touch_term      TEXT,

  -- Multi-touch history [{source, medium, campaign, ts}]
  attribution_history  JSONB NOT NULL DEFAULT '[]',

  registered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE marketing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources     ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede insertar sus propios eventos
DROP POLICY IF EXISTS "marketing_events_insert" ON marketing_events;
CREATE POLICY "marketing_events_insert"
  ON marketing_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Anónimos también (visitantes antes de registrarse)
DROP POLICY IF EXISTS "marketing_events_insert_anon" ON marketing_events;
CREATE POLICY "marketing_events_insert_anon"
  ON marketing_events FOR INSERT
  TO anon
  WITH CHECK (true);

-- Solo admins pueden leer
DROP POLICY IF EXISTS "marketing_events_select_admin" ON marketing_events;
CREATE POLICY "marketing_events_select_admin"
  ON marketing_events FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('admin', 'vendedor'));

-- lead_sources: el usuario ve el suyo, admin ve todos
DROP POLICY IF EXISTS "lead_sources_insert" ON lead_sources;
CREATE POLICY "lead_sources_insert"
  ON lead_sources FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "lead_sources_select_own" ON lead_sources;
CREATE POLICY "lead_sources_select_own"
  ON lead_sources FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR get_my_role() IN ('admin', 'vendedor'));

-- ── Vista: funnel_metrics ─────────────────────────────────────
CREATE OR REPLACE VIEW funnel_metrics AS
WITH steps AS (
  SELECT
    DATE_TRUNC('week', created_at)::DATE                              AS week,
    COUNT(*)          FILTER (WHERE event_type = 'page_view')         AS visits,
    COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'page_view') AS sessions,
    COUNT(*)          FILTER (WHERE event_type = 'landing_empresas_view') AS landing_views,
    COUNT(*)          FILTER (WHERE event_type = 'cta_click')         AS cta_clicks,
    COUNT(*)          FILTER (WHERE event_type = 'registration_complete') AS registrations,
    COUNT(*)          FILTER (WHERE event_type = 'account_approved')  AS approvals,
    COUNT(*)          FILTER (WHERE event_type = 'first_order')       AS first_orders,
    COUNT(DISTINCT utm_campaign) FILTER (WHERE utm_campaign IS NOT NULL) AS active_campaigns
  FROM marketing_events
  GROUP BY 1
)
SELECT *,
  ROUND(100.0 * cta_clicks    / NULLIF(visits, 0), 2)        AS pct_visits_to_cta,
  ROUND(100.0 * registrations / NULLIF(cta_clicks, 0), 2)    AS pct_cta_to_reg,
  ROUND(100.0 * approvals     / NULLIF(registrations, 0), 2) AS pct_reg_to_approved,
  ROUND(100.0 * first_orders  / NULLIF(approvals, 0), 2)     AS pct_approved_to_order
FROM steps
ORDER BY week DESC;
