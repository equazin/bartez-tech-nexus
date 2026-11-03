-- =============================================================================
-- Teqo · Fase 3 · Catálogo público
-- - Columnas nuevas en products: slug (único), images, precio_final_ars y precio_lista_ars
--   (los precios los calcula la fase 4; hasta entonces quedan en NULL y la tienda muestra
--   "Precio a confirmar").
-- - Vista tienda_productos: la única que lee el visitante sin cuenta. Nunca expone costo,
--   multiplicador del proveedor, escalas por cantidad ni pedido mínimo.
-- - Se revoca el acceso anónimo a portal_products, que exponía cost_price y supplier_multiplier.
-- - RPC tienda_categorias() y tienda_buscar(q).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug             text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images           jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS specs            jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS precio_final_ars numeric(14,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS precio_lista_ars numeric(14,2);

-- ── Slug: desde el nombre visible, con el id al final para que sea único ─────
CREATE OR REPLACE FUNCTION tienda_slug(texto text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT trim(both '-' from regexp_replace(lower(unaccent(coalesce(texto, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

CREATE OR REPLACE FUNCTION tienda_productos_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base text;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := tienda_slug(coalesce(NEW.name_custom, NEW.name_original, NEW.name));
    IF base = '' THEN
      base := 'producto';
    END IF;
    NEW.slug := left(base, 80) || '-' || NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tienda_productos_slug ON products;
CREATE TRIGGER trg_tienda_productos_slug
  BEFORE INSERT OR UPDATE OF name, name_custom, name_original, slug ON products
  FOR EACH ROW EXECUTE FUNCTION tienda_productos_slug();

UPDATE products
SET slug = left(coalesce(nullif(tienda_slug(coalesce(name_custom, name_original, name)), ''), 'producto'), 80) || '-' || id::text
WHERE slug IS NULL OR slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

-- ── La vista pública ────────────────────────────────────────────────────────
-- Las specs se filtran acá, no solo en la interfaz: ninguna clave de costo, proveedor
-- ni sincronización sale por la API pública.
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
  p.brand_name                                                  AS marca,
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
        'provider_%', '%token%', '%uuid%', '%external_id%', '%source%', '%last_update%', 'images', 'gallery'
      ])
    )
  )                                                             AS specs,
  p.fts
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.active = true;

GRANT SELECT ON tienda_productos TO anon, authenticated;
REVOKE SELECT ON portal_products FROM anon;

-- ── Categorías públicas con la cantidad de productos (propios y de las hijas) ───
CREATE OR REPLACE FUNCTION tienda_categorias()
RETURNS TABLE (id bigint, nombre text, slug text, padre_id bigint, cantidad int)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH RECURSIVE arbol AS (
    SELECT c.id AS descendiente, c.id AS ancestro
    FROM categories c
    WHERE c.active = true
    UNION ALL
    SELECT a.descendiente, c.parent_id
    FROM arbol a
    JOIN categories c ON c.id = a.ancestro
    WHERE c.parent_id IS NOT NULL
  ),
  directos AS (
    SELECT p.category_id AS cat, count(*)::int AS n
    FROM products p
    WHERE p.active = true AND p.category_id IS NOT NULL
    GROUP BY p.category_id
  )
  SELECT c.id, c.name, c.slug, c.parent_id, coalesce(sum(d.n), 0)::int
  FROM categories c
  LEFT JOIN arbol a ON a.ancestro = c.id
  LEFT JOIN directos d ON d.cat = a.descendiente
  WHERE c.active = true
  GROUP BY c.id, c.name, c.slug, c.parent_id
  ORDER BY c.name;
$$;

GRANT EXECUTE ON FUNCTION tienda_categorias() TO anon, authenticated;

-- ── Búsqueda pública: texto completo en español con respaldo por nombre y SKU ──
CREATE OR REPLACE FUNCTION tienda_buscar(q text, limite int DEFAULT 48)
RETURNS SETOF tienda_productos
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT t.*
  FROM tienda_productos t
  WHERE t.fts @@ websearch_to_tsquery('spanish', q)
     OR t.nombre ILIKE '%' || q || '%'
     OR t.sku ILIKE '%' || q || '%'
  ORDER BY ts_rank(t.fts, websearch_to_tsquery('spanish', q)) DESC, t.destacado DESC, t.nombre
  LIMIT greatest(1, least(limite, 200));
$$;

GRANT EXECUTE ON FUNCTION tienda_buscar(text, int) TO anon, authenticated;
