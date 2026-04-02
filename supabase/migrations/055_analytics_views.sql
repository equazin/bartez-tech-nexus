-- ── 055_analytics_views.sql ────────────────────────────────────────────────
-- Analytics views used by ReportsTab and SalesDashboard.
-- All views are SECURITY DEFINER-equivalent via RLS on base tables.
-- ---------------------------------------------------------------------------

-- Monthly sales aggregated from orders
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

-- Category stats from order_items joined to products
CREATE OR REPLACE VIEW analytics_category_stats AS
SELECT
  p.category,
  COUNT(DISTINCT oi.order_id)            AS order_count,
  SUM(oi.quantity)                       AS units_sold,
  SUM(oi.quantity * oi.unit_price)       AS revenue
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN orders o   ON o.id = oi.order_id
WHERE o.status NOT IN ('cancelled', 'rejected')
GROUP BY 1
ORDER BY revenue DESC;

-- Top products by revenue
CREATE OR REPLACE VIEW analytics_top_products AS
SELECT
  p.id,
  p.name,
  p.category,
  p.sku,
  SUM(oi.quantity)                       AS units_sold,
  SUM(oi.quantity * oi.unit_price)       AS revenue
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN orders o   ON o.id = oi.order_id
WHERE o.status NOT IN ('cancelled', 'rejected')
GROUP BY p.id, p.name, p.category, p.sku
ORDER BY revenue DESC;

-- Client stats
CREATE OR REPLACE VIEW analytics_client_stats AS
SELECT
  pr.id            AS client_id,
  pr.company_name,
  pr.contact_name,
  pr.client_type,
  COUNT(o.id)      AS order_count,
  SUM(o.total)     AS total_spent,
  MAX(o.created_at) AS last_order_at
FROM profiles pr
LEFT JOIN orders o ON o.user_id = pr.id AND o.status NOT IN ('cancelled', 'rejected')
WHERE pr.role IN ('client', 'cliente')
GROUP BY pr.id, pr.company_name, pr.contact_name, pr.client_type
ORDER BY total_spent DESC NULLS LAST;
