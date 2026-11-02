-- ─── 1. UPDATING PRICING RULES TYPES ──────────────────────────
-- Update constraint to support all condition types used in frontend engine
ALTER TABLE pricing_rules DROP CONSTRAINT IF EXISTS pricing_rules_condition_type_check;
ALTER TABLE pricing_rules ADD CONSTRAINT pricing_rules_condition_type_check
  CHECK (condition_type IN ('category','supplier','tag','sku_prefix','product','client'));

-- ─── 2. CALCULATED PRICE FUNCTION (SQL MIRROR OF pricingEngine.ts) ───
-- This ensures the DB can calculate the sell price without exposing the cost_price
CREATE OR REPLACE FUNCTION get_portal_price(p_product_id INTEGER, p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    v_cost NUMERIC;
    v_multiplier NUMERIC;
    v_default_margin NUMERIC;
    v_margin NUMERIC;
    v_rule_result RECORD;
BEGIN
    -- 1. Get product cost and multiplier
    SELECT cost_price, COALESCE(supplier_multiplier, 1)
    INTO v_cost, v_multiplier
    FROM products WHERE id = p_product_id;

    -- 2. Get user default margin from profile
    SELECT COALESCE(default_margin, 20)
    INTO v_default_margin
    FROM profiles WHERE id = p_user_id;

    -- 3. Resolve Margin logic (mirroring pricingEngine.ts)
    -- Priority: product > client > category > supplier/tag/sku_prefix
    SELECT sub.min_margin INTO v_margin
    FROM (
        SELECT r.min_margin, r.priority,
               CASE r.condition_type 
                    WHEN 'product'    THEN 4 
                    WHEN 'client'     THEN 3 
                    WHEN 'category'   THEN 2 
                    ELSE 1 
               END as type_priority
        FROM pricing_rules r
        JOIN products p ON p.id = p_product_id
        WHERE r.active = true
          AND (
              (r.condition_type = 'category'   AND p.category = r.condition_value) OR
              (r.condition_type = 'sku_prefix' AND p.sku ILIKE r.condition_value || '%') OR
              (r.condition_type = 'product'    AND p.id::text = r.condition_value) OR
              (r.condition_type = 'client'     AND p_user_id::text = r.condition_value) OR
              (r.condition_type = 'supplier'   AND p.supplier_id::text = r.condition_value) OR
              (r.condition_type = 'tag'        AND p.tags ? r.condition_value)
          )
        ORDER BY type_priority DESC, r.priority DESC
        LIMIT 1
    ) sub;

    v_margin := COALESCE(v_margin, v_default_margin);

    RETURN ROUND((v_cost * v_multiplier * (1 + v_margin / 100))::numeric, 2);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ─── 3. PORTAL PRODUCTS VIEW ─────────────────────────────────
-- This view hides 'cost_price' and 'supplier_multiplier' from clients.
DROP VIEW IF EXISTS portal_products CASCADE;
CREATE OR REPLACE VIEW portal_products AS
SELECT 
    id, name, description, description_short, description_full, image, 
    category, stock, stock_reserved, sku, active, featured, specs, tags, 
    iva_rate, special_price, offer_percent, min_order_qty, price_tiers,
    brand_id,
    get_portal_price(id::INTEGER, auth.uid()) as unit_price
FROM products
WHERE active = true;

-- Grant permissions (RLS still enforced on products table unless we use SECURITY DEFINER inside view, 
-- but here we rely on the function being SECURITY DEFINER)
GRANT SELECT ON portal_products TO authenticated;
