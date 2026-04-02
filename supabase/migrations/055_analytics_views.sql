-- ── 055_analytics_views.sql ────────────────────────────────────────────────
DROP VIEW IF EXISTS analytics_monthly_sales CASCADE;
DROP VIEW IF EXISTS analytics_category_stats CASCADE;
DROP VIEW IF EXISTS analytics_top_products CASCADE;
DROP VIEW IF EXISTS analytics_client_stats CASCADE;

CREATE OR REPLACE VIEW analytics_monthly_sales AS
SELECT
  date_trunc('month', created_at)::date AS month,
  COUNT(*)                               AS order_count,
  SUM(total)                             AS total_revenue,
  AVG(total)                             AS avg_order_value
FROM orders
WHERE status NOT IN ('cancelled', 'rejected')
GROUP BY 1
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW analytics_category_stats AS
SELECT
  p.category,
  COUNT(DISTINCT o.id)                                          AS order_count,
  SUM((item->>'quantity')::int)                                 AS units_sold,
  SUM((item->>'quantity')::int * (item->>'unit_price')::numeric) AS revenue
FROM orders o
CROSS JOIN LATERAL jsonb_array_elements(o.products) AS item
JOIN products p ON p.id = (item->>'product_id')::int
WHERE o.status NOT IN ('cancelled', 'rejected')
GROUP BY 1
ORDER BY revenue DESC;

CREATE OR REPLACE VIEW analytics_top_products AS
SELECT
  p.id,
  p.name,
  p.category,
  p.sku,
  SUM((item->>'quantity')::int)                                 AS units_sold,
  SUM((item->>'quantity')::int * (item->>'unit_price')::numeric) AS revenue
FROM orders o
CROSS JOIN LATERAL jsonb_array_elements(o.products) AS item
JOIN products p ON p.id = (item->>'product_id')::int
WHERE o.status NOT IN ('cancelled', 'rejected')
GROUP BY p.id, p.name, p.category, p.sku
ORDER BY revenue DESC;

CREATE OR REPLACE VIEW analytics_client_stats AS
SELECT
  pr.id             AS client_id,
  pr.company_name,
  pr.contact_name,
  pr.client_type,
  COUNT(o.id)       AS order_count,
  SUM(o.total)      AS total_spent,
  MAX(o.created_at) AS last_order_at
FROM profiles pr
LEFT JOIN orders o ON o.client_id = pr.id AND o.status NOT IN ('cancelled', 'rejected')
WHERE pr.role IN ('client', 'cliente')
GROUP BY pr.id, pr.company_name, pr.contact_name, pr.client_type
ORDER BY total_spent DESC NULLS LAST;
