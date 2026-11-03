-- ── 012_product_suppliers.sql ───────────────────────────────────────────────
-- Multi-supplier stock and pricing per product
-- Replaces the single supplier_id + stock model with a proper N:M table

-- 1. ── product_suppliers ─────────────────────────────────────────────────────
--    Tracks cost, stock, and multiplier per (product, supplier) pair.
--    This becomes the source of truth for:
--      - available stock per supplier
--      - cost price per supplier
--      - preferred supplier selection
CREATE TABLE IF NOT EXISTS product_suppliers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       INTEGER  NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id      UUID     NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  cost_price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_available  INTEGER  NOT NULL DEFAULT 0 CHECK (stock_available >= 0),
  stock_reserved   INTEGER  NOT NULL DEFAULT 0 CHECK (stock_reserved >= 0),
  price_multiplier NUMERIC(6,4)  NOT NULL DEFAULT 1.0 CHECK (price_multiplier > 0),
  lead_time_days   INTEGER  NOT NULL DEFAULT 0,
  is_preferred     BOOLEAN  NOT NULL DEFAULT false,
  active           BOOLEAN  NOT NULL DEFAULT true,
  external_id      TEXT,                          -- supplier's own SKU/code
  last_synced_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, supplier_id)
);

-- Derived: total available across all active suppliers for a product
CREATE OR REPLACE VIEW product_stock_summary AS
SELECT
  product_id,
  SUM(stock_available)  AS total_available,
  SUM(stock_reserved)   AS total_reserved,
  SUM(stock_available) - SUM(stock_reserved) AS net_available,
  MIN(cost_price)       AS best_cost,
  MIN(lead_time_days)   AS min_lead_time,
  COUNT(*)              AS supplier_count
FROM product_suppliers
WHERE active = true
GROUP BY product_id;

-- RLS
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_select_authenticated"
  ON product_suppliers FOR SELECT TO authenticated USING (true);

CREATE POLICY "ps_admin_write"
  ON product_suppliers FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','vendedor'))
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ps_product_id    ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_ps_supplier_id   ON product_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ps_preferred     ON product_suppliers(product_id, is_preferred) WHERE is_preferred = true;

-- 2. ── Backfill omitido ──────────────────────────────────────────────────────
--    Los productos actuales usan supplier_id como INTEGER legacy,
--    no como UUID FK a suppliers. El backfill se hace desde el admin
--    asignando proveedores UUID a cada producto manualmente o via sync.

-- 3. ── Helper: resolve best supplier for a product ───────────────────────────
--    Priority: preferred → cheapest cost → most stock
CREATE OR REPLACE FUNCTION get_best_supplier(p_product_id INTEGER)
RETURNS TABLE (
  supplier_id      UUID,
  cost_price       NUMERIC(12,2),
  stock_available  INTEGER,
  price_multiplier NUMERIC(6,4),
  lead_time_days   INTEGER
)
LANGUAGE sql STABLE AS $$
  SELECT
    ps.supplier_id,
    ps.cost_price,
    ps.stock_available - ps.stock_reserved AS stock_available,
    ps.price_multiplier,
    ps.lead_time_days
  FROM product_suppliers ps
  WHERE
    ps.product_id      = p_product_id
    AND ps.active      = true
    AND (ps.stock_available - ps.stock_reserved) > 0
  ORDER BY
    ps.is_preferred    DESC,  -- preferred first
    ps.cost_price      ASC,   -- then cheapest
    (ps.stock_available - ps.stock_reserved) DESC  -- then most stock
  LIMIT 1;
$$;

-- 4. ── updated_at trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER product_suppliers_updated_at
  BEFORE UPDATE ON product_suppliers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
