-- --- PHASE 5.4: CATALOG STATISTICS RPC ---
-- Provee conteos reales de categorías y marcas para el sidebar del portal B2B

CREATE OR REPLACE FUNCTION get_catalog_statistics()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'categories', (
            SELECT json_object_agg(category, total)
            FROM (
                SELECT category, count(*) as total
                FROM products
                WHERE active = true
                GROUP BY category
            ) c
        ),
        'brands', (
            SELECT json_object_agg(brand_id, total)
            FROM (
                SELECT brand_id, count(*) as total
                FROM products
                WHERE active = true AND brand_id IS NOT NULL
                GROUP BY brand_id
            ) b
        ),
        'total', (SELECT count(*) FROM products WHERE active = true)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_catalog_statistics IS 'Obtiene estadísticas globales de categorías y marcas para el portal B2B';
