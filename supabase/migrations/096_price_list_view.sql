-- ── 096_price_list_view.sql ───────────────────────────────────────────────────
-- Materialized view: mv_price_list_per_client
-- One row per (client_id, product_id) with the client's personal sell price.
-- Used by the "Descargar lista de precios" feature in the portal catalog.
--
-- Refresh strategy: call refresh_mv_price_list_per_client() nightly via pg_cron
-- or a Supabase Edge Function cron trigger.
--
-- The app NEVER reads the MV directly — it calls get_price_list_for_client(uuid)
-- which filters by client_id and respects catalog_segments.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Materialized view ─────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_price_list_per_client;

CREATE MATERIALIZED VIEW mv_price_list_per_client AS
SELECT
  cli.id                                          AS client_id,
  p.id                                            AS product_id,
  p.sku,
  p.name,
  COALESCE(b.name, '')                            AS brand_name,
  COALESCE(c.name, p.category, '')               AS category,
  get_portal_price(p.id, cli.id)                 AS unit_price,
  GREATEST(p.stock - COALESCE(p.stock_reserved, 0), 0) AS stock,
  COALESCE(p.min_order_qty, 1)                   AS min_order_qty
FROM products p
-- Only active B2B clients
JOIN profiles cli
  ON cli.is_b2b = true
-- Resolve brand name
LEFT JOIN brands b ON b.id = p.brand_id
-- Resolve category name (prefer FK, fallback to text column)
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.active = true;

-- Index for fast per-client lookups
CREATE INDEX IF NOT EXISTS idx_mv_price_list_client
  ON mv_price_list_per_client(client_id);

-- 2. Refresh function ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_mv_price_list_per_client()
RETURNS VOID
LANGUAGE sql SECURITY DEFINER AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_price_list_per_client;
$$;

GRANT EXECUTE ON FUNCTION refresh_mv_price_list_per_client() TO service_role;

-- 3. Per-client accessor (app calls this, never the MV directly) ───────────────
CREATE OR REPLACE FUNCTION get_price_list_for_client(p_client_id UUID)
RETURNS TABLE(
  product_id    INTEGER,
  sku           TEXT,
  name          TEXT,
  brand_name    TEXT,
  category      TEXT,
  unit_price    NUMERIC,
  stock         INTEGER,
  min_order_qty INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    mv.product_id::INTEGER,
    mv.sku,
    mv.name,
    mv.brand_name,
    mv.category,
    mv.unit_price,
    mv.stock::INTEGER,
    mv.min_order_qty::INTEGER
  FROM mv_price_list_per_client mv
  WHERE mv.client_id = p_client_id
    AND mv.product_id NOT IN (
      SELECT h.product_id FROM get_hidden_product_ids_for_client(p_client_id) h
    )
  ORDER BY mv.name;
$$;

GRANT EXECUTE ON FUNCTION get_price_list_for_client(UUID) TO authenticated;
