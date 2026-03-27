-- =============================================================
-- BARTEZ B2B — Migration 002: Orders extended columns + Products price_tiers
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- Fully idempotent — safe to run multiple times
-- =============================================================

-- ─── 1. ORDERS — extended checkout fields ────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_number          text,
  ADD COLUMN IF NOT EXISTS notes                 text,
  ADD COLUMN IF NOT EXISTS payment_method        text,
  ADD COLUMN IF NOT EXISTS payment_surcharge_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS shipping_type         text,
  ADD COLUMN IF NOT EXISTS shipping_address      text,
  ADD COLUMN IF NOT EXISTS shipping_transport    text,
  ADD COLUMN IF NOT EXISTS shipping_cost         numeric(12,2),
  ADD COLUMN IF NOT EXISTS numero_remito         text,
  ADD COLUMN IF NOT EXISTS tracking_number       text,
  ADD COLUMN IF NOT EXISTS shipped_at            timestamptz,
  ADD COLUMN IF NOT EXISTS payment_proofs        jsonb DEFAULT '[]'::jsonb;

-- Extend status CHECK to support full workflow
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','approved','preparing','shipped','delivered','rejected','dispatched'));

-- Index for order_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)
  WHERE order_number IS NOT NULL;

-- ─── 2. PRODUCTS — volume pricing + stock fields ──────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_tiers    jsonb,
  ADD COLUMN IF NOT EXISTS stock_reserved integer      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_order_qty  integer      NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS iva_rate       numeric(5,2) NOT NULL DEFAULT 21;

-- ─── 3. PROFILES — credit + client type fields ───────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credit_limit numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_used  numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_type  text          DEFAULT 'mayorista';

-- ─── 4. SUPPLIERS table (create if not exists) ───────────────

CREATE TABLE IF NOT EXISTS suppliers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  contact_name     text,
  contact_email    text,
  contact_phone    text,
  lead_time_days   integer      NOT NULL DEFAULT 7,
  default_margin   numeric(5,2) NOT NULL DEFAULT 20.00,
  price_multiplier numeric(6,4) NOT NULL DEFAULT 1.0000,
  active           boolean      NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

-- ─── 5. PRICING RULES table (create if not exists) ───────────

CREATE TABLE IF NOT EXISTS pricing_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text         NOT NULL,
  condition_type  text         NOT NULL DEFAULT 'category',
  condition_value text         NOT NULL DEFAULT '',
  min_margin      numeric(5,2) NOT NULL DEFAULT 0,
  max_margin      numeric(5,2),
  fixed_markup    numeric(5,2),
  priority        integer      NOT NULL DEFAULT 0,
  active          boolean      NOT NULL DEFAULT true,
  quantity_breaks jsonb,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now()
);

-- Update constraint if table already existed with old condition types
ALTER TABLE pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_condition_type_check;
ALTER TABLE pricing_rules ADD CONSTRAINT pricing_rules_condition_type_check
  CHECK (condition_type IN ('product','client','category','supplier','tag','sku_prefix'));

ALTER TABLE pricing_rules
  ADD COLUMN IF NOT EXISTS quantity_breaks jsonb;

-- ─── 6. PRICE HISTORY table (create if not exists) ───────────

CREATE TABLE IF NOT EXISTS price_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    integer     NOT NULL,
  changed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_price     numeric(12,2) NOT NULL,
  new_price     numeric(12,2) NOT NULL,
  change_reason text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product
  ON price_history(product_id, created_at DESC);

-- ─── 7. ACTIVITY LOGS table (create if not exists) ───────────

CREATE TABLE IF NOT EXISTS activity_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text        NOT NULL,
  entity_type text,
  entity_id   text,
  metadata    jsonb,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user
  ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action
  ON activity_logs(action, created_at DESC);

-- ─── 8. RLS policies (safe to re-run) ────────────────────────

ALTER TABLE suppliers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop before recreate to avoid duplicate-policy errors
DROP POLICY IF EXISTS "suppliers_read"    ON suppliers;
DROP POLICY IF EXISTS "suppliers_admin"   ON suppliers;
DROP POLICY IF EXISTS "pricing_rules_read"  ON pricing_rules;
DROP POLICY IF EXISTS "pricing_rules_admin" ON pricing_rules;
DROP POLICY IF EXISTS "price_history_read"  ON price_history;
DROP POLICY IF EXISTS "price_history_insert" ON price_history;
DROP POLICY IF EXISTS "activity_logs_own"   ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_admin" ON activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert" ON activity_logs;

CREATE POLICY "suppliers_read"   ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_admin"  ON suppliers FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
);

CREATE POLICY "pricing_rules_read"  ON pricing_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "pricing_rules_admin" ON pricing_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "price_history_read"  ON price_history FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
);
CREATE POLICY "price_history_insert" ON price_history FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "activity_logs_own"    ON activity_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "activity_logs_admin"  ON activity_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
);
CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT WITH CHECK (true);
