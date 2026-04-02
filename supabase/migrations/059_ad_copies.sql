-- ============================================================
-- 059: Ad Copies — generación y aprobación de copies para Google Ads
-- ============================================================

CREATE TABLE IF NOT EXISTS ad_copies (
  id           BIGSERIAL   PRIMARY KEY,
  campaign_id  TEXT        REFERENCES ad_campaigns ON DELETE SET NULL,

  -- Contexto de generación
  category     TEXT        NOT NULL,
  segment      TEXT        NOT NULL DEFAULT 'empresas', -- empresas | resellers | integradores
  product_ids  INT[]       NOT NULL DEFAULT '{}',       -- productos usados como contexto

  -- Copies generados (formato Google Ads RSA)
  headline1    TEXT        NOT NULL,  -- max 30 chars
  headline2    TEXT        NOT NULL,
  headline3    TEXT        NOT NULL,
  description1 TEXT        NOT NULL,  -- max 90 chars
  description2 TEXT        NOT NULL,
  final_url    TEXT,

  -- Estado
  status       TEXT        NOT NULL DEFAULT 'draft', -- draft | approved | rejected | active
  approved_by  UUID        REFERENCES auth.users ON DELETE SET NULL,
  approved_at  TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Métricas si se activó en Google Ads
  impressions  INT         NOT NULL DEFAULT 0,
  clicks       INT         NOT NULL DEFAULT 0,
  ctr          NUMERIC     GENERATED ALWAYS AS (
    CASE WHEN impressions > 0 THEN ROUND(clicks::NUMERIC / impressions * 100, 2) ELSE 0 END
  ) STORED,

  -- Metadata del modelo que generó
  model_used   TEXT,
  prompt_tokens INT,
  generation_ms INT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_copies_status   ON ad_copies (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_copies_category ON ad_copies (category);

-- RLS
ALTER TABLE ad_copies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_copies_admin" ON ad_copies;
CREATE POLICY "ad_copies_admin" ON ad_copies
  USING (get_my_role() IN ('admin', 'vendedor'))
  WITH CHECK (get_my_role() IN ('admin', 'vendedor'));
