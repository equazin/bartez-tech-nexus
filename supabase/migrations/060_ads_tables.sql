-- ============================================================
-- 058: Google Ads — campañas, snapshots de rendimiento, reglas
-- ============================================================

-- ── ad_campaigns ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id           TEXT        PRIMARY KEY,   -- Google Ads campaign ID (o manual)
  name         TEXT        NOT NULL,
  type         TEXT        NOT NULL DEFAULT 'search',  -- search | display | remarketing
  status       TEXT        NOT NULL DEFAULT 'active',  -- active | paused | removed
  daily_budget NUMERIC,
  target_segment TEXT,   -- empresas | resellers | integradores
  notes        TEXT,
  source       TEXT        NOT NULL DEFAULT 'manual',  -- manual | google_ads_api
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ad_performance_snapshots ──────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_performance_snapshots (
  id            BIGSERIAL   PRIMARY KEY,
  campaign_id   TEXT        NOT NULL REFERENCES ad_campaigns ON DELETE CASCADE,
  snapshot_date DATE        NOT NULL,
  impressions   INT         NOT NULL DEFAULT 0,
  clicks        INT         NOT NULL DEFAULT 0,
  cost_ars      NUMERIC     NOT NULL DEFAULT 0,
  conversions   INT         NOT NULL DEFAULT 0,  -- registros atribuidos
  revenue_ars   NUMERIC     NOT NULL DEFAULT 0,  -- ventas atribuidas
  margin_ars    NUMERIC     NOT NULL DEFAULT 0,
  -- Métricas calculadas
  ctr           NUMERIC GENERATED ALWAYS AS (
    CASE WHEN impressions > 0 THEN ROUND(clicks::NUMERIC / impressions * 100, 2) ELSE 0 END
  ) STORED,
  cpc_ars       NUMERIC GENERATED ALWAYS AS (
    CASE WHEN clicks > 0 THEN ROUND(cost_ars / clicks, 2) ELSE 0 END
  ) STORED,
  cpl_ars       NUMERIC GENERATED ALWAYS AS (
    CASE WHEN conversions > 0 THEN ROUND(cost_ars / conversions, 2) ELSE NULL END
  ) STORED,
  roas          NUMERIC GENERATED ALWAYS AS (
    CASE WHEN cost_ars > 0 THEN ROUND(revenue_ars / cost_ars, 2) ELSE 0 END
  ) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ad_snapshots_campaign_date
  ON ad_performance_snapshots (campaign_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_ad_snapshots_date
  ON ad_performance_snapshots (snapshot_date DESC);

-- ── ad_rules ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_rules (
  id          BIGSERIAL   PRIMARY KEY,
  name        TEXT        NOT NULL,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  -- Condición: { metric, operator, value, window_days }
  condition   JSONB       NOT NULL,
  -- Acción: { type, value? } — pause_campaign | increase_budget | decrease_budget | alert
  action      JSONB       NOT NULL,
  last_fired  TIMESTAMPTZ,
  fire_count  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── api_usage_log ─────────────────────────────────────────────
-- Control de costos de APIs externas
CREATE TABLE IF NOT EXISTS api_usage_log (
  id          BIGSERIAL   PRIMARY KEY,
  api_name    TEXT        NOT NULL,  -- google_ads | serper | bing | mercadolibre
  operation   TEXT        NOT NULL,  -- sync | search | etc.
  units_used  INT         NOT NULL DEFAULT 1,
  cost_usd    NUMERIC,
  success     BOOLEAN     NOT NULL DEFAULT TRUE,
  error_msg   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_name_date
  ON api_usage_log (api_name, created_at DESC);

-- ── Vista: campaign_performance ───────────────────────────────
CREATE OR REPLACE VIEW campaign_performance AS
SELECT
  c.id,
  c.name,
  c.type,
  c.status,
  c.daily_budget,
  c.target_segment,
  c.source,
  -- Últimos 30 días
  SUM(s.impressions)  FILTER (WHERE s.snapshot_date >= CURRENT_DATE - 30) AS impressions_30d,
  SUM(s.clicks)       FILTER (WHERE s.snapshot_date >= CURRENT_DATE - 30) AS clicks_30d,
  SUM(s.cost_ars)     FILTER (WHERE s.snapshot_date >= CURRENT_DATE - 30) AS cost_30d,
  SUM(s.conversions)  FILTER (WHERE s.snapshot_date >= CURRENT_DATE - 30) AS conversions_30d,
  SUM(s.revenue_ars)  FILTER (WHERE s.snapshot_date >= CURRENT_DATE - 30) AS revenue_30d,
  CASE
    WHEN SUM(s.cost_ars) FILTER (WHERE s.snapshot_date >= CURRENT_DATE - 30) > 0
    THEN ROUND(SUM(s.revenue_ars) FILTER (WHERE s.snapshot_date >= CURRENT_DATE - 30)
         / SUM(s.cost_ars) FILTER (WHERE s.snapshot_date >= CURRENT_DATE - 30), 2)
    ELSE 0
  END AS roas_30d,
  CASE
    WHEN SUM(s.conversions) FILTER (WHERE s.snapshot_date >= CURRENT_DATE - 30) > 0
    THEN ROUND(SUM(s.cost_ars) FILTER (WHERE s.snapshot_date >= CURRENT_DATE - 30)
         / SUM(s.conversions) FILTER (WHERE s.snapshot_date >= CURRENT_DATE - 30), 2)
    ELSE NULL
  END AS cpl_30d,
  MAX(s.snapshot_date) AS last_synced
FROM ad_campaigns c
LEFT JOIN ad_performance_snapshots s ON s.campaign_id = c.id
GROUP BY c.id, c.name, c.type, c.status, c.daily_budget, c.target_segment, c.source;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE ad_campaigns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_rules                ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_log           ENABLE ROW LEVEL SECURITY;

-- Solo admins/vendedores pueden leer/escribir
DROP POLICY IF EXISTS "ad_campaigns_admin" ON ad_campaigns;
CREATE POLICY "ad_campaigns_admin" ON ad_campaigns
  USING (get_my_role() IN ('admin', 'vendedor'))
  WITH CHECK (get_my_role() IN ('admin', 'vendedor'));

DROP POLICY IF EXISTS "ad_snapshots_admin" ON ad_performance_snapshots;
CREATE POLICY "ad_snapshots_admin" ON ad_performance_snapshots
  USING (get_my_role() IN ('admin', 'vendedor'))
  WITH CHECK (get_my_role() IN ('admin', 'vendedor'));

DROP POLICY IF EXISTS "ad_rules_admin" ON ad_rules;
CREATE POLICY "ad_rules_admin" ON ad_rules
  USING (get_my_role() IN ('admin', 'vendedor'))
  WITH CHECK (get_my_role() IN ('admin', 'vendedor'));

DROP POLICY IF EXISTS "api_usage_admin" ON api_usage_log;
CREATE POLICY "api_usage_admin" ON api_usage_log
  USING (get_my_role() = 'admin');
