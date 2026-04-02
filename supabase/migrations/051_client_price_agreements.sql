-- ── 051_client_price_agreements.sql ──────────────────────────────────────────
-- Price contracts / agreements between Bartez and B2B clients.
-- Allows locking a negotiated price list for a client over a date range,
-- overriding the default margin-based pricing engine.
-- Fully idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Agreements table
CREATE TABLE IF NOT EXISTS client_price_agreements (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Human-readable name for the contract, e.g. "Acuerdo Q1 2026"
  name          TEXT NOT NULL,
  -- Fixed margin override (percentage). NULL = use client default_margin.
  margin_pct    NUMERIC(5,2),
  -- Optional extra discount on top of margin (e.g. promo -5%)
  discount_pct  NUMERIC(5,2) DEFAULT 0,
  -- Price list base: mayorista | distribuidor | standard
  price_list    TEXT NOT NULL DEFAULT 'mayorista'
                CHECK (price_list IN ('mayorista', 'distribuidor', 'standard')),
  -- Validity window
  valid_from    DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until   DATE,
  -- Status
  active        BOOLEAN NOT NULL DEFAULT true,
  notes         TEXT,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT chk_valid_dates CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CONSTRAINT chk_margin_range CHECK (margin_pct IS NULL OR (margin_pct >= 0 AND margin_pct <= 200)),
  CONSTRAINT chk_discount_range CHECK (discount_pct >= 0 AND discount_pct <= 100)
);

COMMENT ON TABLE client_price_agreements IS
  'Negotiated price contracts for B2B clients: fixed margin + discount over a date range.';

-- 2. Product-level price overrides (optional per-SKU fixed prices)
CREATE TABLE IF NOT EXISTS price_agreement_items (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agreement_id  BIGINT NOT NULL REFERENCES client_price_agreements(id) ON DELETE CASCADE,
  product_id    BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- If set, this exact price (in USD) overrides the margin calculation
  fixed_price_usd NUMERIC(12,2),
  -- If set, this margin % overrides the agreement-level margin for this SKU
  margin_pct    NUMERIC(5,2),
  created_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE (agreement_id, product_id)
);

COMMENT ON TABLE price_agreement_items IS
  'Per-SKU price overrides within a client price agreement.';

-- 3. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_price_agreement_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_price_agreement_updated_at ON client_price_agreements;
CREATE TRIGGER trg_price_agreement_updated_at
  BEFORE UPDATE ON client_price_agreements
  FOR EACH ROW EXECUTE FUNCTION update_price_agreement_ts();

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_price_agreements_client_id ON client_price_agreements(client_id);
CREATE INDEX IF NOT EXISTS idx_price_agreements_active    ON client_price_agreements(active, valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_price_agreement_items_agreement ON price_agreement_items(agreement_id);

-- 5. RLS
ALTER TABLE client_price_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_agreement_items   ENABLE ROW LEVEL SECURITY;

-- Client: can view their own active agreements
CREATE POLICY "client_price_agreement_select"
  ON client_price_agreements FOR SELECT TO authenticated
  USING (client_id = auth.uid() AND active = true);

-- Admin: full access to agreements
CREATE POLICY "admin_price_agreement_all"
  ON client_price_agreements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Client: can view items for their own agreements
CREATE POLICY "client_agreement_items_select"
  ON price_agreement_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_price_agreements a
      WHERE a.id = agreement_id AND a.client_id = auth.uid() AND a.active = true
    )
  );

-- Admin: full access to items
CREATE POLICY "admin_agreement_items_all"
  ON price_agreement_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 6. RPC: get active agreement for a client (most recent valid one)
CREATE OR REPLACE FUNCTION get_active_price_agreement(p_client_id UUID)
RETURNS TABLE (
  agreement_id    BIGINT,
  name            TEXT,
  margin_pct      NUMERIC,
  discount_pct    NUMERIC,
  price_list      TEXT,
  valid_from      DATE,
  valid_until     DATE
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, name, margin_pct, discount_pct, price_list, valid_from, valid_until
    FROM client_price_agreements
   WHERE client_id  = p_client_id
     AND active     = true
     AND valid_from <= CURRENT_DATE
     AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
   ORDER BY valid_from DESC
   LIMIT 1;
$$;
