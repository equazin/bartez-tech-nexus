-- =============================================================================
-- Teqo · Precio por medio de pago
--
-- Cada medio suma un recargo sobre el precio final con IVA del producto, configurable
-- desde el panel (Configuración › Transferencia y medios): de arranque, transferencia
-- 5 % y Mercado Pago 15 % (decisión de Nico del 3/11/2026). El envío no lleva recargo.
--
-- 1. medios_de_pago.recargo_porcentaje (0 a 100).
-- 2. tienda_precio_con_recargo(precio, recargo): el precio con el recargo, con el mismo
--    redondeo que el resto de los precios.
-- 3. La vista pública muestra como precio_final_ars (y precio_lista_ars en ofertas) el del
--    medio activo más barato, y suma precios_por_medio: [{id, nombre, recargo, precio}],
--    ordenado del más barato al más caro. El checkout del servidor cobra el del medio elegido.
-- Idempotente.
-- =============================================================================

ALTER TABLE medios_de_pago ADD COLUMN IF NOT EXISTS recargo_porcentaje numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE medios_de_pago DROP CONSTRAINT IF EXISTS medios_de_pago_recargo_rango;
ALTER TABLE medios_de_pago ADD CONSTRAINT medios_de_pago_recargo_rango CHECK (recargo_porcentaje >= 0 AND recargo_porcentaje <= 100);

-- Valores de arranque: solo si todavía no se cargó otro desde el panel.
UPDATE medios_de_pago SET recargo_porcentaje = 5  WHERE id = 'transferencia' AND recargo_porcentaje = 0;
UPDATE medios_de_pago SET recargo_porcentaje = 15 WHERE id = 'mercadopago'   AND recargo_porcentaje = 0;

CREATE OR REPLACE FUNCTION tienda_precio_con_recargo(p_precio numeric, p_recargo numeric)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_precio IS NULL THEN NULL
    ELSE tienda_redondear(p_precio * (1 + coalesce(p_recargo, 0) / 100))
  END;
$$;

CREATE OR REPLACE VIEW tienda_productos AS
WITH medios AS (
  SELECT id, nombre, recargo_porcentaje, orden
  FROM medios_de_pago
  WHERE activo = true
),
minimo AS (
  SELECT coalesce(min(recargo_porcentaje), 0) AS recargo FROM medios
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
  tienda_precio_con_recargo(p.precio_final_ars, mi.recargo)::numeric(14,2) AS precio_final_ars,
  tienda_precio_con_recargo(p.precio_lista_ars, mi.recargo)::numeric(14,2) AS precio_lista_ars,
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
          'recargo', m.recargo_porcentaje,
          'precio', tienda_precio_con_recargo(p.precio_final_ars, m.recargo_porcentaje)
        )
        ORDER BY m.recargo_porcentaje, m.orden
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
