-- =============================================================
-- BARTEZ B2B — Wholesale Scale Migration
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- ─── 1. PROVEEDORES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  lead_time_days  integer NOT NULL DEFAULT 7,
  default_margin  numeric(5,2) NOT NULL DEFAULT 20.00,
  price_multiplier numeric(6,4) NOT NULL DEFAULT 1.0000,
  active          boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Link products → suppliers (products already have supplier_id as int, migrate carefully)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS supplier_uuid uuid REFERENCES suppliers(id) ON DELETE SET NULL;

-- ─── 2. REGLAS DE PRECIOS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  condition_type  text NOT NULL CHECK (condition_type IN ('category','supplier','tag','sku_prefix')),
  condition_value text NOT NULL,
  min_margin      numeric(5,2) NOT NULL DEFAULT 0,
  max_margin      numeric(5,2),
  fixed_markup    numeric(5,2),          -- optional absolute markup override
  priority        integer NOT NULL DEFAULT 0,  -- higher = evaluated first
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Seed default rules (examples — edit in admin)
INSERT INTO pricing_rules (name, condition_type, condition_value, min_margin, priority)
VALUES
  ('Redes — margen mínimo 18%',       'category', 'Redes',           18, 10),
  ('Seguridad — margen mínimo 22%',    'category', 'Seguridad',       22, 10),
  ('Infraestructura — margen mín 15%', 'category', 'Infraestructura', 15, 10)
ON CONFLICT DO NOTHING;

-- ─── 3. HISTORIAL DE PRECIOS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS price_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      integer NOT NULL,          -- matches products.id (int legacy)
  changed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_price       numeric(12,2) NOT NULL,
  new_price       numeric(12,2) NOT NULL,
  change_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id, created_at DESC);

-- ─── 4. LOG DE ACTIVIDAD ────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL,   -- 'search','view_product','add_to_cart','place_order','login','logout'
  entity_type text,            -- 'product','order','quote'
  entity_id   text,
  metadata    jsonb,
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action, created_at DESC);

-- ─── 5. ROW LEVEL SECURITY ──────────────────────────────────

-- suppliers: admin can do anything, authenticated can read
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_read"   ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_admin"  ON suppliers FOR ALL    USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
);

-- pricing_rules: admin/vendedor read, admin write
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_rules_read"  ON pricing_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "pricing_rules_admin" ON pricing_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- price_history: admin/vendedor read
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_history_read"  ON price_history FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
);
CREATE POLICY "price_history_insert" ON price_history FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- activity_logs: users see their own, admin sees all
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_logs_own"   ON activity_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "activity_logs_admin" ON activity_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
);
CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT WITH CHECK (true);

-- ─── 6. PROFILES: ADD VENDEDOR ROLE ─────────────────────────
-- The role column should already exist. Add 'vendedor' to valid values.
-- If using a CHECK constraint, update it:
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('client', 'cliente', 'admin', 'vendedor'));

-- ─── 7. UPDATED_AT TRIGGER ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pricing_rules_updated_at
  BEFORE UPDATE ON pricing_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 8. HELPER VIEWS ─────────────────────────────────────────

-- Productos sin movimiento (sin pedidos en los últimos 90 días)
CREATE OR REPLACE VIEW products_without_movement AS
SELECT
  p.id, p.name, p.sku, p.category, p.stock, p.cost_price,
  p.updated_at AS last_updated,
  COUNT(DISTINCT o.id) AS total_orders
FROM products p
LEFT JOIN orders o ON o.products::jsonb @> jsonb_build_array(jsonb_build_object('product_id', p.id))
  AND o.created_at >= NOW() - INTERVAL '90 days'
WHERE p.active = true
GROUP BY p.id
HAVING COUNT(DISTINCT o.id) = 0
ORDER BY p.stock DESC;

-- Productos con stock bajo
CREATE OR REPLACE VIEW products_low_stock AS
SELECT
  p.id, p.name, p.sku, p.category,
  p.stock, p.stock_min,
  COALESCE(p.stock_reserved, 0) AS reserved,
  (p.stock - COALESCE(p.stock_reserved, 0)) AS available,
  s.name AS supplier_name
FROM products p
LEFT JOIN suppliers s ON s.id = p.supplier_uuid
WHERE p.active = true
  AND p.stock_min IS NOT NULL
  AND p.stock <= p.stock_min
ORDER BY (p.stock - COALESCE(p.stock_reserved, 0)) ASC;
