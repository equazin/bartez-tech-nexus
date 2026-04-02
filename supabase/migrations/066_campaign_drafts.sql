-- ============================================================
-- 066: Campaign Drafts — AI-generated campaigns awaiting approval
-- ============================================================

CREATE TABLE IF NOT EXISTS campaign_drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who / when
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status workflow: draft → pending_review → approved / rejected → launched
  status          TEXT NOT NULL DEFAULT 'pending_review'
                  CHECK (status IN ('pending_review','approved','rejected','launched','launch_error')),

  -- Campaign metadata
  name            TEXT NOT NULL,
  objective       TEXT NOT NULL,          -- 'leads' | 'ventas' | 'awareness'
  campaign_type   TEXT NOT NULL DEFAULT 'search',
  target_segment  TEXT,
  daily_budget_ars NUMERIC(12,2),
  location_target TEXT NOT NULL DEFAULT 'Argentina',

  -- Full AI-generated structure (Google Ads RSA format)
  -- {
  --   ad_groups: [{ name, keywords: string[], headlines: string[], descriptions: string[] }],
  --   negative_keywords: string[],
  --   bidding_strategy: string,
  --   notes: string
  -- }
  campaign_structure JSONB NOT NULL DEFAULT '{}',

  -- AI metadata
  ai_model        TEXT,
  ai_prompt_tokens INT,
  ai_completion_tokens INT,

  -- Google Ads result after launch
  google_ads_campaign_id TEXT,
  launch_error    TEXT,

  -- Review notes
  reviewer_notes  TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_drafts_status ON campaign_drafts(status);
CREATE INDEX IF NOT EXISTS idx_campaign_drafts_created_at ON campaign_drafts(created_at DESC);

-- RLS
ALTER TABLE campaign_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_drafts_admin ON campaign_drafts;
CREATE POLICY campaign_drafts_admin ON campaign_drafts
  FOR ALL USING (get_my_role() IN ('admin', 'vendedor'));
