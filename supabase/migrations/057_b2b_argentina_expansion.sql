-- ── 057_b2b_argentina_expansion.sql ──────────────────────────────────────────
-- Data structures for AFIP integration, IIBB perceptions, and advanced B2B credit.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend profiles with AR-specific B2B fields
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS cuit TEXT,
  ADD COLUMN IF NOT EXISTS iibb_aliquot NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iibb_province TEXT, -- 'CABA', 'BA', 'Cordoba', etc.
  ADD COLUMN IF NOT EXISTS credit_days_limit INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS reseller_markup_config JSONB DEFAULT '{}'::jsonb; -- { logo_url: string, default_markup: number }

COMMENT ON COLUMN profiles.cuit IS 'Tax ID for Argentinian clients (CUIT/CUIL).';
COMMENT ON COLUMN profiles.iibb_aliquot IS 'IIBB perception percentage to apply.';
COMMENT ON COLUMN profiles.credit_days_limit IS 'Days allowed for payment before blocking the client.';

-- 2. Extend invoices with AFIP and Tax data
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS afip_cae TEXT,
  ADD COLUMN IF NOT EXISTS afip_cae_due DATE,
  ADD COLUMN IF NOT EXISTS afip_qr TEXT,
  ADD COLUMN IF NOT EXISTS afip_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'error'
  ADD COLUMN IF NOT EXISTS iibb_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS perception_details JSONB DEFAULT '[]'::jsonb; -- Detailed breakdown of taxes

-- 3. Extend orders with Price Lock against inflation
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS price_lock_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.price_lock_expires_at IS 'Timestamp until which the quoted ARS price is guaranteed.';

-- 4. New table for Logistics Carriers (Andreani, OCA, etc.)
CREATE TABLE IF NOT EXISTS shipping_carriers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_config JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed defaults
INSERT INTO shipping_carriers (id, name) VALUES 
  ('andreani', 'Andreani'),
  ('oca', 'OCA'),
  ('correo_arg', 'Correo Argentino')
ON CONFLICT (id) DO NOTHING;

-- 5. Extend account_movements to support E-Checks
ALTER TABLE account_movements
  ADD COLUMN IF NOT EXISTS echeck_id TEXT,
  ADD COLUMN IF NOT EXISTS maturity_date DATE; -- When the check can be cashed
