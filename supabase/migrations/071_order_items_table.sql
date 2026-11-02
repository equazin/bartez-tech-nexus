-- ── 068_order_items_table.sql ─────────────────────────────────────────────────
-- Creates a normalized order_items table alongside the existing JSONB field.
-- This enables product-level analytics, FK integrity, and efficient queries like
-- "all orders containing product X" without a full JSONB scan.
--
-- Strategy: ADDITIVE only — the JSONB products column is NOT removed.
-- The new table is backfilled from existing JSONB data.
-- New orders continue writing to JSONB (for compatibility) AND to order_items.
--
-- Migration is fully idempotent and safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the normalized table
CREATE TABLE IF NOT EXISTS order_items (
  id             BIGSERIAL PRIMARY KEY,
  order_id       BIGINT       NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id     INTEGER      NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  name           TEXT         NOT NULL,
  sku            TEXT,
  quantity       INTEGER      NOT NULL CHECK (quantity > 0),
  cost_price     NUMERIC(14,4),
  unit_price     NUMERIC(14,4) NOT NULL,
  total_price    NUMERIC(14,4) NOT NULL,
  margin         NUMERIC(6,2),
  iva_rate       NUMERIC(5,2)  DEFAULT 21,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2. Indexes for common access patterns
CREATE INDEX IF NOT EXISTS idx_order_items_order_id    ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id  ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created_at  ON order_items(created_at DESC);

-- 3. RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Admin/vendedor: full access
DROP POLICY IF EXISTS order_items_admin_all  ON order_items;
CREATE POLICY order_items_admin_all ON order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid()
        AND role IN ('admin', 'vendedor')
    )
  );

-- Client: read own order items only
DROP POLICY IF EXISTS order_items_client_read ON order_items;
CREATE POLICY order_items_client_read ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders WHERE id = order_items.order_id
        AND client_id = auth.uid()
    )
  );

-- 4. Backfill from existing JSONB data (idempotent — skips already-inserted rows)
INSERT INTO order_items (order_id, product_id, name, sku, quantity, cost_price, unit_price, total_price, margin, iva_rate, created_at)
SELECT
  o.id                                          AS order_id,
  (item->>'product_id')::INTEGER                AS product_id,
  COALESCE(item->>'name', 'Producto')           AS name,
  item->>'sku'                                  AS sku,
  GREATEST(1, (item->>'quantity')::INTEGER)     AS quantity,
  (item->>'cost_price')::NUMERIC                AS cost_price,
  COALESCE((item->>'unit_price')::NUMERIC, 0)   AS unit_price,
  COALESCE((item->>'total_price')::NUMERIC, 0)  AS total_price,
  (item->>'margin')::NUMERIC                    AS margin,
  COALESCE((item->>'iva_rate')::NUMERIC, 21)    AS iva_rate,
  o.created_at                                  AS created_at
FROM orders o,
  LATERAL jsonb_array_elements(
    CASE jsonb_typeof(o.products)
      WHEN 'array' THEN o.products
      ELSE '[]'::jsonb
    END
  ) AS item
WHERE (item->>'product_id') IS NOT NULL
  AND (item->>'product_id')::INTEGER > 0
  -- Skip rows already inserted (idempotent)
  AND NOT EXISTS (
    SELECT 1 FROM order_items oi
    WHERE oi.order_id = o.id
      AND oi.product_id = (item->>'product_id')::INTEGER
  )
ON CONFLICT DO NOTHING;

-- 5. Helper view: product sales analytics
CREATE OR REPLACE VIEW product_sales_summary AS
SELECT
  oi.product_id,
  p.name                              AS product_name,
  p.sku,
  p.brand_name,
  p.category,
  COUNT(DISTINCT oi.order_id)         AS total_orders,
  SUM(oi.quantity)                    AS total_units_sold,
  SUM(oi.total_price)                 AS total_revenue,
  AVG(oi.unit_price)                  AS avg_unit_price,
  AVG(oi.margin)                      AS avg_margin,
  MAX(o.created_at)                   AS last_sold_at
FROM order_items oi
JOIN products p  ON p.id  = oi.product_id
JOIN orders   o  ON o.id  = oi.order_id
WHERE o.status NOT IN ('rejected', 'pending_approval')
GROUP BY oi.product_id, p.name, p.sku, p.brand_name, p.category;

COMMENT ON TABLE order_items IS
  'Normalized line items for orders. Populated alongside the legacy JSONB products column. '
  'Use this table for analytics, FK queries, and product-level reporting.';
