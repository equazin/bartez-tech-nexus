-- =============================================================================
-- Teqo · Ficha técnica ordenada y marca visible
--
-- 1. products.ficha: la ficha técnica que se carga desde el panel o el CSV, como lista
--    de pares [{"clave": "Pantalla", "valor": "27 pulgadas"}, ...]. Un objeto jsonb no
--    conserva el orden de las claves; una lista sí. La tienda usa la ficha si tiene
--    algo y, si no, las especificaciones del mayorista (specs) filtradas.
-- 2. La marca visible sale de brand_name, de la marca vinculada (brand_id) o, si no hay
--    ninguna, de la que manda el mayorista (specs.supplier_brand), con el nombre de la
--    tabla de marcas cuando coincide ("LOGITECH" se muestra "Logitech").
-- 3. Las specs del mayorista dejan de mostrar ean, manufacturer_part_number y
--    weight_kg, que salían en la ficha con etiquetas en inglés.
-- Idempotente.
-- =============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS ficha jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE VIEW tienda_productos AS
SELECT
  p.id,
  p.slug,
  coalesce(p.name_custom, p.name_original, p.name)              AS nombre,
  p.description_short                                           AS descripcion_corta,
  coalesce(p.description_full, p.description)                   AS descripcion,
  CASE
    WHEN jsonb_typeof(p.images) = 'array' AND jsonb_array_length(p.images) > 0 THEN p.images
    WHEN p.image IS NOT NULL AND p.image <> '' THEN jsonb_build_array(p.image)
    ELSE '[]'::jsonb
  END                                                           AS imagenes,
  p.image                                                       AS imagen,
  p.category                                                    AS categoria_nombre,
  p.category_id                                                 AS categoria_id,
  c.slug                                                        AS categoria_slug,
  p.brand_id                                                    AS marca_id,
  coalesce(
    nullif(trim(p.brand_name), ''),
    b.name,
    (SELECT bm.name FROM brands bm WHERE lower(bm.name) = lower(trim(p.specs->>'supplier_brand')) LIMIT 1),
    nullif(trim(p.specs->>'supplier_brand'), '')
  )                                                             AS marca,
  greatest(p.stock - coalesce(p.stock_reserved, 0), 0) > 0      AS hay_stock,
  greatest(p.stock - coalesce(p.stock_reserved, 0), 0) BETWEEN 1 AND 3 AS pocas_unidades,
  p.sku,
  p.iva_rate,
  p.precio_final_ars,
  p.precio_lista_ars,
  (p.precio_lista_ars IS NOT NULL AND p.precio_final_ars IS NOT NULL
    AND p.precio_lista_ars > p.precio_final_ars)                AS oferta,
  p.tags,
  p.weight_kg                                                   AS peso_kg,
  coalesce(p.featured, false)                                   AS destacado,
  (
    SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    FROM jsonb_each(coalesce(p.specs, '{}'::jsonb)) AS e
    WHERE NOT (
      e.key ILIKE ANY (ARRAY[
        '%cost%', '%costo%', '%markup%', '%margen%', '%pvp%', '%exchange%', '%cotizacion%', '%precio%',
        'elit_%', 'air_%', 'invid_%', 'supplier_%', 'preferred_supplier_%', 'sync_%', 'internal_%',
        'provider_%', '%token%', '%uuid%', '%external_id%', '%source%', '%last_update%', 'images', 'gallery',
        'ean', 'manufacturer_part_number', 'weight_kg'
      ])
    )
  )                                                             AS specs,
  p.fts,
  CASE WHEN jsonb_typeof(p.ficha) = 'array' THEN p.ficha ELSE '[]'::jsonb END AS ficha
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN brands b ON b.id = p.brand_id
WHERE p.active = true AND p.publicado = true;

GRANT SELECT ON tienda_productos TO anon, authenticated;
