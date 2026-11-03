-- =============================================================================
-- Teqo · Proveedores por API sin desbordar la tienda
--
-- 1. Los proveedores AIR, ELIT e INVID existen de entrada (la sincronización de AIR
--    falla si no encuentra la fila; la de ELIT e INVID la creaba sola).
-- 2. products.publicado: una sincronización trae miles de artículos activos del
--    mayorista y la tienda es un catálogo curado de 50 a 80 productos. Lo que entra
--    queda sin publicar hasta que el panel lo publique. La vista pública, la búsqueda,
--    el conteo de categorías y el prerender solo ven lo publicado.
-- 3. El costo (products.cost_price) siempre está en dólares: la sincronización lo
--    normaliza dividiendo por la cotización del mayorista cuando cotiza en pesos
--    (normalizeUsdCost en src/lib/api/supplierSync.ts). El precio final ya no mira la
--    moneda de origen, que hacía tratar como pesos un costo ya pasado a dólares.
-- 4. Categoría automática: si un producto llega sin category_id, se busca su categoría
--    de proveedor (products.category) en category_mapping y, si no está, por nombre o
--    slug entre las categorías activas. Cargar un mapeo nuevo reubica los productos que
--    estaban sin categoría.
-- Idempotente.
-- =============================================================================

-- 1. Proveedores
INSERT INTO suppliers (name, lead_time_days, default_margin, price_multiplier, active, notes)
SELECT v.nombre, 0, 0, 1, true, v.nota
FROM (VALUES
  ('AIR',   'Mayorista por API (api.air-intra.com). Credenciales en Vercel: AIR_API_USER y AIR_API_PASS.'),
  ('ELIT',  'Mayorista por API (clientes.elit.com.ar). Credenciales en Vercel: ELIT_API_USER_ID y ELIT_API_TOKEN.'),
  ('INVID', 'Mayorista por API (invidcomputers.com). Credenciales en Vercel: INVID_USER e INVID_PASSWORD.')
) AS v(nombre, nota)
WHERE NOT EXISTS (SELECT 1 FROM suppliers s WHERE lower(trim(s.name)) = lower(v.nombre));

-- 2. Publicado
ALTER TABLE products ADD COLUMN IF NOT EXISTS publicado boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_products_publicado ON products(publicado) WHERE publicado;

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
WHERE p.active = true AND p.publicado = true;

GRANT SELECT ON tienda_productos TO anon, authenticated;

CREATE OR REPLACE FUNCTION tienda_categorias()
RETURNS TABLE (id bigint, nombre text, slug text, padre_id bigint, cantidad int, orden int, descripcion text)
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
    WHERE p.active = true AND p.publicado = true AND p.category_id IS NOT NULL
    GROUP BY p.category_id
  )
  SELECT c.id, c.name, c.slug, c.parent_id, coalesce(sum(d.n), 0)::int, c.orden, c.descripcion
  FROM categories c
  LEFT JOIN arbol a ON a.ancestro = c.id
  LEFT JOIN directos d ON d.cat = a.descendiente
  WHERE c.active = true
  GROUP BY c.id, c.name, c.slug, c.parent_id, c.orden, c.descripcion
  ORDER BY c.orden, c.name;
$$;

GRANT EXECUTE ON FUNCTION tienda_categorias() TO anon, authenticated;

-- 3. Precio final con el costo siempre en dólares
CREATE OR REPLACE FUNCTION tienda_calcular_precio(p products, p_dolar numeric)
RETURNS TABLE (precio_final numeric, precio_lista numeric)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_costo  numeric;
  v_iva    numeric;
  v_margen numeric;
  v_lista  numeric;
  v_final  numeric;
  v_oferta numeric;
BEGIN
  IF p_dolar IS NULL OR p_dolar <= 0 THEN
    RETURN QUERY SELECT NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  v_costo := coalesce(p.cost_price, 0) * coalesce(p.supplier_multiplier, 1) * p_dolar;
  IF v_costo <= 0 THEN
    RETURN QUERY SELECT NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  v_iva    := coalesce(p.iva_rate, 21);
  v_margen := tienda_margen_para(p);
  v_lista  := tienda_redondear(v_costo * (1 + v_margen / 100) * (1 + v_iva / 100));
  v_final  := v_lista;

  IF p.special_price IS NOT NULL AND p.special_price > 0 THEN
    v_oferta := tienda_redondear(p.special_price * p_dolar * (1 + v_iva / 100));
    IF v_oferta < v_final THEN v_final := v_oferta; END IF;
  END IF;

  IF p.offer_percent IS NOT NULL AND p.offer_percent > 0 THEN
    v_oferta := tienda_redondear(v_lista * (1 - p.offer_percent / 100));
    IF v_oferta < v_final THEN v_final := v_oferta; END IF;
  END IF;

  RETURN QUERY SELECT v_final, CASE WHEN v_final < v_lista THEN v_lista ELSE NULL::numeric END;
END;
$$;

-- 4. Categoría automática
CREATE OR REPLACE FUNCTION tienda_categoria_para(p_categoria_proveedor text)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    (
      SELECT cm.internal_category_id
      FROM category_mapping cm
      JOIN categories c ON c.id = cm.internal_category_id AND c.active = true
      WHERE lower(trim(cm.external_category_name)) = lower(trim(p_categoria_proveedor))
      ORDER BY (cm.confidence = 'manual') DESC, cm.updated_at DESC NULLS LAST
      LIMIT 1
    ),
    (
      SELECT c.id
      FROM categories c
      WHERE c.active = true
        AND (lower(c.name) = lower(trim(p_categoria_proveedor)) OR c.slug = tienda_slug(p_categoria_proveedor))
      ORDER BY c.parent_id NULLS LAST
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION tienda_asignar_categoria()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(trim(NEW.category), '') = '' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.category_id IS NULL THEN
      NEW.category_id := tienda_categoria_para(NEW.category);
    END IF;
  ELSIF NEW.category IS DISTINCT FROM OLD.category AND NEW.category_id IS NOT DISTINCT FROM OLD.category_id THEN
    -- Cambió el nombre de categoría (panel o proveedor) sin tocar el id: se reubica si hay
    -- a dónde; si no, queda donde estaba.
    NEW.category_id := coalesce(tienda_categoria_para(NEW.category), NEW.category_id);
  ELSIF NEW.category_id IS NULL THEN
    NEW.category_id := tienda_categoria_para(NEW.category);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tienda_asignar_categoria ON products;
CREATE TRIGGER trg_tienda_asignar_categoria
  BEFORE INSERT OR UPDATE OF category, category_id ON products
  FOR EACH ROW EXECUTE FUNCTION tienda_asignar_categoria();

CREATE OR REPLACE FUNCTION tienda_aplicar_mapeo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.internal_category_id IS NOT NULL AND coalesce(trim(NEW.external_category_name), '') <> '' THEN
    UPDATE products
    SET category_id = NEW.internal_category_id
    WHERE category_id IS NULL
      AND lower(trim(category)) = lower(trim(NEW.external_category_name));
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tienda_aplicar_mapeo ON category_mapping;
CREATE TRIGGER trg_tienda_aplicar_mapeo
  AFTER INSERT OR UPDATE OF internal_category_id, external_category_name ON category_mapping
  FOR EACH ROW EXECUTE FUNCTION tienda_aplicar_mapeo();

-- Productos que ya estuvieran sin categoría
UPDATE products SET category_id = tienda_categoria_para(category)
WHERE category_id IS NULL AND coalesce(trim(category), '') <> '';

SELECT recalcular_precios();
