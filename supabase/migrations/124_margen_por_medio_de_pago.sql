-- =============================================================================
-- Teqo · El margen sobre el costo lo pone el medio de pago
--
-- Decisión de Nico del 3/11/2026: el margen es sobre el costo y depende de cómo paga el
-- cliente: transferencia 5 %, Mercado Pago 15 %. Reemplaza al margen global.
--
--   precio con un medio = costo en pesos × (1 + margen del medio) × (1 + IVA), redondeado
--
-- 1. medios_de_pago.recargo_porcentaje pasa a llamarse margen_porcentaje (0 a 500 %).
-- 2. tienda_margen_para ya no usa margen_base: devuelve el margen de una regla de precios
--    que coincida (producto, categoría, proveedor, etiqueta o SKU) o 0. Una regla suma un
--    margen adicional sobre el del medio. margen_base queda en 0 y sin uso.
-- 3. Se recalculan los precios: products.precio_final_ars queda como costo con IVA (más la
--    regla o la oferta que corresponda) y la vista suma el margen de cada medio.
-- 4. La vista pública ya no muestra el porcentaje de cada medio: con el margen y el precio
--    se podría calcular el costo, y costo y margen nunca salen por la API pública.
-- Idempotente.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'medios_de_pago' AND column_name = 'recargo_porcentaje') THEN
    ALTER TABLE medios_de_pago RENAME COLUMN recargo_porcentaje TO margen_porcentaje;
  END IF;
END $$;

ALTER TABLE medios_de_pago ADD COLUMN IF NOT EXISTS margen_porcentaje numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE medios_de_pago DROP CONSTRAINT IF EXISTS medios_de_pago_recargo_rango;
ALTER TABLE medios_de_pago DROP CONSTRAINT IF EXISTS medios_de_pago_margen_rango;
ALTER TABLE medios_de_pago ADD CONSTRAINT medios_de_pago_margen_rango CHECK (margen_porcentaje >= 0 AND margen_porcentaje <= 500);
COMMENT ON COLUMN medios_de_pago.margen_porcentaje IS 'Margen sobre el costo cuando el cliente paga con este medio. Se edita en Configuración › Transferencia y medios.';

UPDATE medios_de_pago SET margen_porcentaje = 5  WHERE id = 'transferencia';
UPDATE medios_de_pago SET margen_porcentaje = 15 WHERE id = 'mercadopago';

-- 2. Sin margen global: solo las reglas de precios suman margen sobre el costo.
CREATE OR REPLACE FUNCTION tienda_margen_para(p products)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  WITH nombres AS (
    SELECT lower(trim(coalesce(p.category, ''))) AS nombre
    UNION
    SELECT lower(x.valor)
    FROM categories c
    LEFT JOIN categories madre ON madre.id = c.parent_id
    CROSS JOIN LATERAL (VALUES (c.name), (c.slug), (madre.name), (madre.slug)) AS x(valor)
    WHERE c.id = p.category_id AND x.valor IS NOT NULL
  )
  SELECT coalesce(
    (
      SELECT CASE WHEN r.fixed_markup IS NOT NULL THEN r.fixed_markup ELSE r.min_margin END
      FROM pricing_rules r
      WHERE r.active = true
        AND (r.expires_at IS NULL OR r.expires_at > now())
        AND (
             (r.condition_type = 'product'    AND r.condition_value = p.id::text)
          OR (r.condition_type = 'category'   AND lower(trim(r.condition_value)) IN (SELECT nombre FROM nombres))
          OR (r.condition_type = 'supplier'   AND (r.condition_value = coalesce(p.supplier_id::text, '') OR lower(trim(r.condition_value)) = lower(trim(coalesce(p.supplier_name, '')))))
          OR (r.condition_type = 'tag'        AND lower(trim(r.condition_value)) IN (SELECT lower(trim(t)) FROM unnest(coalesce(p.tags, ARRAY[]::text[])) AS t))
          OR (r.condition_type = 'sku_prefix' AND upper(coalesce(p.sku, '')) LIKE upper(r.condition_value) || '%')
        )
      ORDER BY r.priority DESC,
               CASE r.condition_type WHEN 'product' THEN 4 WHEN 'category' THEN 2 ELSE 1 END DESC
      LIMIT 1
    ),
    0
  );
$$;

UPDATE tienda_configuracion
SET valor = '0'::jsonb,
    descripcion = 'Sin uso desde el 3/11/2026: el margen sobre el costo lo pone cada medio de pago (Configuración › Transferencia y medios).'
WHERE clave = 'margen_base';

-- 4. La vista: el precio de cada medio, sin su porcentaje.
CREATE OR REPLACE VIEW tienda_productos AS
WITH medios AS (
  SELECT id, nombre, margen_porcentaje, orden
  FROM medios_de_pago
  WHERE activo = true
),
minimo AS (
  SELECT coalesce(min(margen_porcentaje), 0) AS margen FROM medios
)
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
  tienda_precio_con_recargo(p.precio_final_ars, mi.margen)::numeric(14,2) AS precio_final_ars,
  tienda_precio_con_recargo(p.precio_lista_ars, mi.margen)::numeric(14,2) AS precio_lista_ars,
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
  CASE WHEN jsonb_typeof(p.ficha) = 'array' THEN p.ficha ELSE '[]'::jsonb END AS ficha,
  (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'nombre', m.nombre,
          'precio', tienda_precio_con_recargo(p.precio_final_ars, m.margen_porcentaje)
        )
        ORDER BY m.margen_porcentaje, m.orden
      ),
      '[]'::jsonb
    )
    FROM medios m
  )                                                             AS precios_por_medio
FROM products p
CROSS JOIN minimo mi
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN brands b ON b.id = p.brand_id
WHERE p.active = true AND p.publicado = true;

GRANT SELECT ON tienda_productos TO anon, authenticated;

-- 3. Los precios guardados pasan a ser costo con IVA (sin margen global).
SELECT recalcular_precios();
