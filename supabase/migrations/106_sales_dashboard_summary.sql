-- ── 106_sales_dashboard_summary.sql ──────────────────────────────────────────
-- Precomputed sales metrics for the admin dashboard.
--
-- SalesDashboard was re-aggregating thousands of orders on every render. This
-- migration moves the heavy aggregation to Postgres and exposes it via a
-- materialized view + a thin RPC. The client reads the summary in O(1).
--
-- Refresh strategy: call refresh_sales_dashboard_summary() on demand from the
-- admin UI when staff need fresh numbers, or schedule it (pg_cron / Edge
-- Function) every 5-15 minutes. The view is intentionally a single-row
-- aggregate so REFRESH is cheap.
--
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Materialized view ───────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS mv_sales_dashboard_summary;

CREATE MATERIALIZED VIEW mv_sales_dashboard_summary AS
WITH revenue_orders AS (
  SELECT
    o.id,
    o.total,
    o.created_at,
    o.products
  FROM orders o
  WHERE o.status IN ('approved', 'preparing', 'shipped', 'dispatched', 'delivered')
),
periods AS (
  SELECT
    date_trunc('month', now())                   AS cur_start,
    date_trunc('month', now()) + INTERVAL '1 month' AS cur_end,
    date_trunc('month', now() - INTERVAL '1 month') AS prev_start,
    date_trunc('month', now())                   AS prev_end
),
totals AS (
  SELECT
    COUNT(*)::INTEGER                                  AS approved_count,
    COALESCE(SUM(total), 0)::NUMERIC(14, 2)            AS total_revenue
  FROM revenue_orders
),
month_breakdown AS (
  SELECT
    SUM(CASE WHEN ro.created_at >= p.cur_start  AND ro.created_at < p.cur_end  THEN ro.total ELSE 0 END)::NUMERIC(14, 2) AS cur_revenue,
    SUM(CASE WHEN ro.created_at >= p.prev_start AND ro.created_at < p.prev_end THEN ro.total ELSE 0 END)::NUMERIC(14, 2) AS prev_revenue,
    COUNT(*) FILTER (WHERE ro.created_at >= p.cur_start  AND ro.created_at < p.cur_end)::INTEGER  AS cur_orders,
    COUNT(*) FILTER (WHERE ro.created_at >= p.prev_start AND ro.created_at < p.prev_end)::INTEGER AS prev_orders
  FROM revenue_orders ro
  CROSS JOIN periods p
),
margin_calc AS (
  SELECT
    COALESCE(SUM((item->>'margin')::NUMERIC * (item->>'total_price')::NUMERIC), 0) AS weighted,
    COALESCE(SUM(CASE
      WHEN item ? 'margin' AND item ? 'total_price' THEN (item->>'total_price')::NUMERIC
      ELSE 0
    END), 0) AS base
  FROM revenue_orders ro,
       LATERAL jsonb_array_elements(COALESCE(ro.products, '[]'::JSONB)) item
  WHERE item ? 'margin' AND item ? 'total_price'
),
pending_orders AS (
  SELECT COUNT(*)::INTEGER AS pending_count
  FROM orders
  WHERE status = 'pending'
)
SELECT
  t.approved_count,
  t.total_revenue,
  p.pending_count,
  m.cur_revenue,
  m.prev_revenue,
  m.cur_orders,
  m.prev_orders,
  CASE WHEN mc.base > 0 THEN (mc.weighted / mc.base)::NUMERIC(8, 4) ELSE 0::NUMERIC(8, 4) END AS avg_margin,
  CASE WHEN m.prev_revenue > 0 THEN ((m.cur_revenue - m.prev_revenue) / m.prev_revenue * 100)::NUMERIC(8, 2) ELSE NULL END AS mom_pct,
  CASE WHEN m.prev_orders  > 0 THEN ((m.cur_orders::NUMERIC - m.prev_orders) / m.prev_orders * 100)::NUMERIC(8, 2) ELSE NULL END AS orders_pct,
  CASE
    WHEN m.prev_orders > 0 AND m.cur_orders > 0
    THEN (((m.cur_revenue / m.cur_orders) - (m.prev_revenue / m.prev_orders))
          / (m.prev_revenue / m.prev_orders) * 100)::NUMERIC(8, 2)
    ELSE NULL
  END AS avg_ticket_pct,
  now() AS refreshed_at
FROM totals t
CROSS JOIN month_breakdown m
CROSS JOIN margin_calc mc
CROSS JOIN pending_orders p;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_sales_dashboard_summary_refresh
  ON mv_sales_dashboard_summary(refreshed_at);

-- 2. Refresh helper ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_sales_dashboard_summary()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'vendedor') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_dashboard_summary;
  RETURN now();
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_sales_dashboard_summary() TO authenticated;

-- 3. Reader RPC ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_sales_dashboard_summary()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_row  RECORD;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role NOT IN ('admin', 'vendedor') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_row FROM mv_sales_dashboard_summary LIMIT 1;
  IF v_row IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'approved_count',  v_row.approved_count,
    'pending_count',   v_row.pending_count,
    'total_revenue',   v_row.total_revenue,
    'cur_revenue',     v_row.cur_revenue,
    'prev_revenue',    v_row.prev_revenue,
    'cur_orders',      v_row.cur_orders,
    'prev_orders',     v_row.prev_orders,
    'avg_margin',      v_row.avg_margin,
    'mom_pct',         v_row.mom_pct,
    'orders_pct',      v_row.orders_pct,
    'avg_ticket_pct',  v_row.avg_ticket_pct,
    'refreshed_at',    v_row.refreshed_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_sales_dashboard_summary() TO authenticated;

-- 4. Initial populate ────────────────────────────────────────────────────────
-- The view is empty after CREATE; populate it now so the dashboard works
-- on first read after deploy.
REFRESH MATERIALIZED VIEW mv_sales_dashboard_summary;
