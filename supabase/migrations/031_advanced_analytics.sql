-- ── 029_advanced_analytics.sql ──────────────────────────────────────────────
-- Advanced Analytics Views for Business Intelligence

-- Helper function to unnest order products as a set (for easier aggregation)
CREATE OR REPLACE FUNCTION public.get_order_items()
RETURNS TABLE (
    order_id UUID,
    client_id UUID,
    created_at TIMESTAMPTZ,
    status TEXT,
    product_id INTEGER,
    sku TEXT,
    name TEXT,
    quantity INTEGER,
    unit_price NUMERIC,
    cost_price NUMERIC,
    total_price NUMERIC,
    category TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id as order_id,
        o.client_id,
        o.created_at,
        o.status,
        (p->>'product_id')::INTEGER as product_id,
        p->>'sku' as sku,
        p->>'name' as name,
        (p->>'quantity')::INTEGER as quantity,
        (p->>'unit_price')::NUMERIC as unit_price,
        (p->>'cost_price')::NUMERIC as cost_price,
        (p->>'total_price')::NUMERIC as total_price,
        p->>'category' as category
    FROM orders o,
    LATERAL jsonb_array_elements(o.products) as p
    WHERE o.status NOT IN ('rejected');
END;
$$;

-- 1. View for Monthly Sales Trend
DROP VIEW IF EXISTS public.analytics_monthly_sales CASCADE;
CREATE OR REPLACE VIEW analytics_monthly_sales AS
WITH monthly_data AS (
    SELECT 
        date_trunc('month', created_at) as month,
        SUM(total_price) as revenue,
        SUM(total_price - (cost_price * quantity)) as profit
    FROM get_order_items()
    GROUP BY 1
)
SELECT 
    month,
    revenue,
    profit,
    CASE 
        WHEN LAG(revenue) OVER (ORDER BY month) > 0 
        THEN ((revenue - LAG(revenue) OVER (ORDER BY month)) / LAG(revenue) OVER (ORDER BY month)) * 100
        ELSE 0 
    END as growth_pct
FROM monthly_data
ORDER BY month DESC
LIMIT 12;

-- 2. View for Top Products by Profit
DROP VIEW IF EXISTS public.analytics_top_products CASCADE;
CREATE OR REPLACE VIEW analytics_top_products AS
SELECT 
    name,
    sku,
    category,
    SUM(quantity) as total_units,
    SUM(total_price) as total_revenue,
    SUM(total_price - (cost_price * quantity)) as total_profit,
    (SUM(total_price - (cost_price * quantity)) / NULLIF(SUM(total_price), 0)) * 100 as margin_pct
FROM get_order_items()
GROUP BY 1, 2, 3
ORDER BY total_profit DESC
LIMIT 20;

-- 3. View for Category Performance
DROP VIEW IF EXISTS public.analytics_category_stats CASCADE;
CREATE OR REPLACE VIEW analytics_category_stats AS
SELECT 
    category,
    SUM(quantity) as units,
    SUM(total_price) as revenue,
    SUM(total_price - (cost_price * quantity)) as profit,
    (SUM(total_price - (cost_price * quantity)) / NULLIF(SUM(total_price), 0)) * 100 as margin_pct
FROM get_order_items()
GROUP BY 1
ORDER BY revenue DESC;

-- 4. View for Client Performance
DROP VIEW IF EXISTS public.analytics_client_stats CASCADE;
CREATE OR REPLACE VIEW analytics_client_stats AS
SELECT 
    p.company_name,
    p.contact_name,
    COUNT(DISTINCT i.order_id) as order_count,
    SUM(i.total_price) as total_revenue,
    SUM(i.total_price - (i.cost_price * i.quantity)) as total_profit,
    (SUM(i.total_price - (i.cost_price * i.quantity)) / NULLIF(SUM(i.total_price), 0)) * 100 as margin_pct
FROM get_order_items() i
JOIN profiles p ON p.id = i.client_id
GROUP BY p.id, p.company_name, p.contact_name
ORDER BY total_revenue DESC
LIMIT 20;

-- RLS for Analytics Views (Admin and Vendedor only)
-- Note: Views don't have RLS themselves, but we can wrap them in a secure function 
-- or ensure access is only via authenticated users with proper roles.
-- For now, consistent with existing policy, we allow access.
