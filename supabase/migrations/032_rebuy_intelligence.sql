-- ── 032_rebuy_intelligence.sql ──────────────────────────────────────────────
-- Smart Rebuy Engine: Predicts when a client needs to reorder based on history

-- 1. Unnest order products to analyze individual history
DROP VIEW IF EXISTS public.rebuy_recommendations CASCADE;
DROP VIEW IF EXISTS public.rebuy_analytics CASCADE;
DROP VIEW IF EXISTS public.order_items_view CASCADE;

CREATE OR REPLACE VIEW public.order_items_view AS
SELECT 
    o.id AS order_id,
    o.client_id,
    o.created_at,
    (p_item->>'product_id')::INTEGER AS product_id,
    (p_item->>'quantity')::INTEGER AS quantity
FROM orders o
CROSS JOIN LATERAL jsonb_array_elements(o.products) p_item
WHERE o.status NOT IN ('rejected', 'pending_approval');

-- 2. Calculate average interval between purchases (client + product)
-- We only consider clients with at least 3 purchases of the same product
CREATE OR REPLACE VIEW public.rebuy_analytics AS
WITH intervals AS (
    SELECT 
        client_id,
        product_id,
        created_at,
        LAG(created_at) OVER (PARTITION BY client_id, product_id ORDER BY created_at) as prev_purchase
    FROM order_items_view
),
stats AS (
    SELECT 
        client_id,
        product_id,
        COUNT(*) as purchase_count,
        MAX(created_at) as last_purchase_date,
        -- Convert days to interval more safely
        AVG(EXTRACT(EPOCH FROM (created_at - prev_purchase)) / 86400)::NUMERIC(10,2) as avg_days_interval
    FROM intervals
    WHERE prev_purchase IS NOT NULL
    GROUP BY client_id, product_id
)
SELECT * FROM stats WHERE purchase_count >= 3;

-- 3. Final recommendations view
CREATE OR REPLACE VIEW public.rebuy_recommendations AS
SELECT 
    s.client_id,
    s.product_id,
    p.name as product_name,
    p.image as product_image,
    p.sku as product_sku,
    s.purchase_count,
    s.last_purchase_date,
    s.avg_days_interval,
    -- Safer interval addition
    (s.last_purchase_date + (s.avg_days_interval || ' days')::INTERVAL) as estimated_next_purchase,
    ROUND(EXTRACT(EPOCH FROM ((s.last_purchase_date + (s.avg_days_interval || ' days')::INTERVAL) - now())) / 86400) as days_until_next
FROM rebuy_analytics s
JOIN products p ON s.product_id = p.id
WHERE 
    (s.last_purchase_date + (s.avg_days_interval || ' days')::INTERVAL) <= (now() + INTERVAL '7 days')
    AND p.active = true;

-- Grant access
GRANT SELECT ON public.order_items_view TO authenticated;
GRANT SELECT ON public.rebuy_analytics TO authenticated;
GRANT SELECT ON public.rebuy_recommendations TO authenticated;
