-- 043_revert_cost_currency.sql
-- Eliminar la columna cost_currency y actualizar la vista portal_products.

-- 1. Eliminar la vista que depende de la columna
DROP VIEW IF EXISTS portal_products;

-- 2. Eliminar la columna cost_currency
ALTER TABLE public.products DROP COLUMN IF EXISTS cost_currency;

-- 3. Recrear la vista portal_products sin la columna cost_currency
CREATE OR REPLACE VIEW portal_products AS
SELECT 
    p.id,
    p.name,
    p.name_custom,
    p.name_original,
    p.description,
    p.image,
    p.category,
    p.stock,
    p.cost_price,
    p.sku,
    p.supplier_multiplier,
    p.iva_rate,
    p.special_price,
    p.offer_percent,
    p.brand_id,
    p.brand_name,
    p.active,
    p.featured,
    p.tags,
    p.price_tiers,
    p.min_order_qty,
    p.stock_reserved,
    p.weight_kg,
    COALESCE(p.name_custom, p.name_original, p.name) as display_name
FROM products p
WHERE p.active = true;

GRANT SELECT ON portal_products TO authenticated;
GRANT SELECT ON portal_products TO anon;

COMMENT ON VIEW portal_products IS 'Vista optimizada para el portal B2B (Foco en USD)';
