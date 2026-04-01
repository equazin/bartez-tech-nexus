-- --- PHASE 5.4: MULTIMONEDA EN COSTOS Y PORTAL REPAIR ---

-- 1. Agregar columna cost_currency a la tabla products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS cost_currency TEXT DEFAULT 'USD' CHECK (cost_currency IN ('USD', 'ARS'));

COMMENT ON COLUMN products.cost_currency IS 'Moneda en la que se expresa el cost_price (USD o ARS)';

-- 1.5. Asegurar existencia de weight_kg (requerido por la vista y migraciones anteriores)
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_kg NUMERIC DEFAULT 0;

-- 2. Actualizar la vista portal_products para incluir el nuevo campo
-- Primero borramos para recrear con la nueva estructura
DROP VIEW IF EXISTS portal_products;

CREATE VIEW portal_products AS
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
    p.cost_currency, -- Nuevo campo
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
    -- Calculamos un unit_price sugerido basado en USD como base (si el costo es ARS se divide por una cotización base o se deja como está según usePricing)
    -- Para la vista, simplemente exponemos los datos crudos y que el Hook usePricing haga la magia pesada.
    COALESCE(p.name_custom, p.name_original, p.name) as display_name
FROM products p
WHERE p.active = true;

COMMENT ON VIEW portal_products IS 'Vista optimizada para el portal B2B con soporte multimoneda';
