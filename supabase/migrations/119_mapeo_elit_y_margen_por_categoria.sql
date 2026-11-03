-- =============================================================================
-- Teqo · Mapeo de categorías de ELIT y margen por categoría de Teqo
--
-- 1. ELIT nombra sus categorías "Rubro / Subrubro" ("Imagen / Monitores"). Se mapean a
--    las de Teqo las que entran en el catálogo del plan de marca. Los componentes
--    sueltos (Hardware, Memorias, discos internos), las mini PC y las consolas quedan
--    sin mapear a propósito: sin categoría de Teqo no se ven aunque se publiquen por
--    error, y vender componentes sigue siendo una decisión abierta.
-- 2. Las reglas de precio por categoría comparaban solo con el texto del proveedor.
--    Ahora una regla "category" también coincide con el nombre o el slug de la
--    categoría de Teqo del producto o de su categoría madre: "Monitores" cubre
--    "Monitores para jugar".
-- 3. El precio se recalcula también cuando cambia category_id (antes solo con el texto).
-- 4. Las tres reglas heredadas de Bartez (Redes, Seguridad, Infraestructura) apuntan a
--    categorías que en Teqo no existen: quedan inactivas, no se borran.
-- Idempotente.
-- =============================================================================

-- 1. Mapeo de ELIT
INSERT INTO category_mapping (supplier_id, external_category_id, external_category_name, internal_category_id, confidence)
SELECT s.id, m.externa, m.externa, c.id, 'manual'
FROM (VALUES
  ('Periféricos / Teclados',                 'teclados'),
  ('Periféricos / Mouses',                   'mouse'),
  ('Periféricos / Mouse Pads',               'mousepads'),
  ('Periféricos / Joysticks',                'joysticks-y-volantes'),
  ('Perifëricos / Joysticks',                'joysticks-y-volantes'),
  ('Simuladores / Volantes',                 'joysticks-y-volantes'),
  ('Audio / Auriculares',                    'auriculares'),
  ('Audio / Micrófonos',                     'streaming'),
  ('Imagen / Monitores',                     'monitores'),
  ('Imagen / Soportes',                      'soportes-de-monitor'),
  ('Computadoras / Notebooks Consumo',       'notebooks-para-estudiar-y-trabajar'),
  ('Computadoras / Notebooks Corporativo',   'notebooks-para-estudiar-y-trabajar'),
  ('Almacenamiento / Discos Externos',       'ssd-externos-y-pendrives'),
  ('Almacenamiento / Discos Externos SSD',   'ssd-externos-y-pendrives'),
  ('Conectividad / Routers',                 'routers-y-wifi'),
  ('Unidad de Energia / Cargadores Portátiles', 'cargadores'),
  ('Unidad de Energia / Estabilizadores',    'estabilizadores-y-ups'),
  ('Unidad de Energia / Ups',                'estabilizadores-y-ups'),
  ('Unidad de Energia / Protectores',        'estabilizadores-y-ups'),
  ('Estuches / Fundas',                      'mochilas-y-fundas')
) AS m(externa, slug)
JOIN suppliers s ON lower(s.name) = 'elit'
JOIN categories c ON c.slug = m.slug
ON CONFLICT (supplier_id, external_category_id) DO UPDATE
  SET internal_category_id = EXCLUDED.internal_category_id,
      external_category_name = EXCLUDED.external_category_name,
      confidence = 'manual',
      updated_at = now();

-- 2. Margen: la regla de categoría también mira la categoría de Teqo y su madre
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
    tienda_config_numero('margen_base', 20)
  );
$$;

-- 3. Recalcular también al cambiar la categoría de Teqo
DROP TRIGGER IF EXISTS trg_tienda_precio_en_el_producto ON products;
CREATE TRIGGER trg_tienda_precio_en_el_producto
  BEFORE INSERT OR UPDATE OF cost_price, supplier_multiplier, special_price, offer_percent, iva_rate,
                             primary_supplier_id, category, category_id, tags, sku, precio_manual ON products
  FOR EACH ROW EXECUTE FUNCTION tienda_precio_en_el_producto();

-- 4. Reglas heredadas de Bartez
UPDATE pricing_rules SET active = false
WHERE condition_type = 'category' AND condition_value IN ('Redes', 'Seguridad', 'Infraestructura') AND active;

SELECT recalcular_precios();
