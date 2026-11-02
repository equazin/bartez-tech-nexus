-- ── 101_purchase_analytics_views.sql ─────────────────────────────────────────
-- Per-client purchase analytics RPCs for the portal Reports section.
-- All functions return data only for auth.uid() — no MV needed.
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Purchases by category ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_purchases_by_category(
  p_months INTEGER DEFAULT 12
)
RETURNS TABLE(
  category   TEXT,
  units_sold BIGINT,
  revenue    NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COALESCE(p.category, 'Sin categoría') AS category,
    SUM((item->>'quantity')::int)          AS units_sold,
    SUM((item->>'quantity')::int * (item->>'unit_price')::numeric) AS revenue
  FROM orders o
  CROSS JOIN LATERAL jsonb_array_elements(o.products) AS item
  JOIN products p ON p.id = (item->>'product_id')::int
  WHERE o.client_id = auth.uid()
    AND o.status NOT IN ('cancelled', 'rejected')
    AND o.created_at >= (now() - (p_months || ' months')::interval)
  GROUP BY 1
  ORDER BY revenue DESC
  LIMIT 10;
$$;
GRANT EXECUTE ON FUNCTION get_my_purchases_by_category(INTEGER) TO authenticated;

-- 2. Top products ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_top_products(
  p_months INTEGER DEFAULT 12,
  p_limit  INTEGER DEFAULT 10
)
RETURNS TABLE(
  product_id INTEGER,
  name       TEXT,
  sku        TEXT,
  units_sold BIGINT,
  revenue    NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id                                                           AS product_id,
    p.name,
    p.sku,
    SUM((item->>'quantity')::int)                                  AS units_sold,
    SUM((item->>'quantity')::int * (item->>'unit_price')::numeric) AS revenue
  FROM orders o
  CROSS JOIN LATERAL jsonb_array_elements(o.products) AS item
  JOIN products p ON p.id = (item->>'product_id')::int
  WHERE o.client_id = auth.uid()
    AND o.status NOT IN ('cancelled', 'rejected')
    AND o.created_at >= (now() - (p_months || ' months')::interval)
  GROUP BY p.id, p.name, p.sku
  ORDER BY revenue DESC
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION get_my_top_products(INTEGER,INTEGER) TO authenticated;

-- 3. Monthly trend ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_monthly_trend(
  p_months INTEGER DEFAULT 12
)
RETURNS TABLE(
  month        DATE,
  order_count  BIGINT,
  revenue      NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    date_trunc('month', o.created_at)::date AS month,
    COUNT(*)                                 AS order_count,
    SUM(o.total)                             AS revenue
  FROM orders o
  WHERE o.client_id = auth.uid()
    AND o.status NOT IN ('cancelled', 'rejected')
    AND o.created_at >= (now() - (p_months || ' months')::interval)
  GROUP BY 1
  ORDER BY 1 ASC;
$$;
GRANT EXECUTE ON FUNCTION get_my_monthly_trend(INTEGER) TO authenticated;
