-- ── 065_custom_pricing_cart_tokens.sql ──────────────────────────────────
-- Listas de Precios Pactadas & Cart Reconstruction
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Client-Specific Custom Prices (Pactados/Netos)
CREATE TABLE IF NOT EXISTS client_custom_prices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  product_id      INTEGER REFERENCES products(id) ON DELETE CASCADE,
  custom_price    NUMERIC NOT NULL, -- Net price agreed
  currency        TEXT DEFAULT 'USD' CHECK (currency IN ('ARS','USD')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, product_id)
);

-- 2. Cart Tokens (For sharing carts via WhatsApp/Email links)
CREATE TABLE IF NOT EXISTS shared_carts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  items           JSONB NOT NULL, -- The products and quantities
  created_by      UUID REFERENCES profiles(id),
  expires_at      TIMESTAMPTZ DEFAULT (now() + INTERVAL '15 days'),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 3. Modify Price Fetching Logic (Helper for app)
-- We return the 'best' price: either the pactado OR the segmented price.
CREATE OR REPLACE FUNCTION get_client_price_v2(p_client_id UUID, p_product_id INTEGER, p_base_price NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
  v_custom_price  NUMERIC;
  v_segment_pct   NUMERIC;
  v_profile       RECORD;
BEGIN
  -- 1. Check for specific pactado price
  SELECT custom_price INTO v_custom_price 
  FROM client_custom_prices 
  WHERE client_id = p_client_id AND product_id = p_product_id;

  IF v_custom_price IS NOT NULL THEN
     RETURN v_custom_price;
  END IF;

  -- 2. Fallback to normal segment logic
  SELECT segment INTO v_profile FROM profiles WHERE id = p_client_id;
  
  CASE v_profile.segment
    WHEN 'A' THEN v_segment_pct := 0.05; -- 5% discount or different logic
    WHEN 'B' THEN v_segment_pct := 0.10;
    ELSE v_segment_pct := 0;
  END CASE;

  RETURN p_base_price * (1 - v_segment_pct);
END;
$$ LANGUAGE plpgsql STABLE;
