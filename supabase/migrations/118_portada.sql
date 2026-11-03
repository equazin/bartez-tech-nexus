-- =============================================================================
-- Teqo · Plan de página y contenido · Fase B · Portada completa
-- (docs/plan-pagina-y-contenido.md, sección 3)
--
-- - La vista pública suma creado_en, nuevo (ingresó hace menos de dias_nuevo días) y
--   ahorro_pct (cuánto baja el precio final contra el de lista, redondeado hacia abajo).
-- - tienda_mas_vendidos(): lo más vendido de las últimas cuatro semanas (pedidos pagados en
--   adelante); mientras no haya ventas suficientes, los destacados.
-- - tienda_marcas(): las marcas activas con productos a la vista.
-- - tienda_portada(): el elegido de la semana y los datos de la franja de confianza.
-- - panel_guardar_portada(): el administrador carga el elegido, la garantía y los días de Nuevo.
-- Idempotente.
-- =============================================================================

INSERT INTO tienda_configuracion (clave, valor, descripcion) VALUES
  ('dias_nuevo',     '30'::jsonb,   'Días que un producto lleva la etiqueta Nuevo desde que entra al catálogo.'),
  ('garantia_meses', 'null'::jsonb, 'Meses de garantía que la portada promete. Nulo: la franja muestra un marcador hasta que Andrés lo confirme.'),
  ('elegido_semana', 'null'::jsonb, 'El elegido de la semana: producto_id, cuatro datos clave y tres razones. Nulo: la portada no muestra el bloque.')
ON CONFLICT (clave) DO NOTHING;

-- ── La vista pública con creado_en, nuevo y ahorro_pct ──────────────────────
CREATE OR REPLACE VIEW tienda_productos AS
WITH RECURSIVE dias_nuevo AS (
  -- Cuántos días un producto lleva la etiqueta Nuevo (tienda_configuracion.dias_nuevo, 30 si falta).
  SELECT coalesce((
    SELECT (valor #>> '{}')::int FROM tienda_configuracion
    WHERE clave = 'dias_nuevo' AND jsonb_typeof(valor) = 'number' AND (valor #>> '{}')::numeric BETWEEN 0 AND 365
  ), 30) AS dias
),
publicas AS (
  SELECT c.id, c.slug,
         CASE WHEN nullif(trim(c.etiqueta_heredada), '') IS NULL THEN ARRAY[]::text[] ELSE ARRAY[lower(trim(c.etiqueta_heredada))] END AS heredadas,
         1 AS nivel
  FROM categories c
  WHERE c.active AND c.parent_id IS NULL
  UNION ALL
  SELECT c.id, c.slug,
         pub.heredadas || CASE WHEN nullif(trim(c.etiqueta_heredada), '') IS NULL THEN ARRAY[]::text[] ELSE ARRAY[lower(trim(c.etiqueta_heredada))] END,
         pub.nivel + 1
  FROM categories c
  JOIN publicas pub ON c.parent_id = pub.id
  WHERE c.active AND pub.nivel < 10
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
  pub.slug                                                      AS categoria_slug,
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
  p.fts,
  ARRAY(
    SELECT DISTINCT lower(trim(e))
    FROM unnest(coalesce(p.tags, ARRAY[]::text[]) || pub.heredadas) AS e
    WHERE nullif(trim(e), '') IS NOT NULL
    ORDER BY 1
  )                                                             AS etiquetas,
  p.created_at                                                  AS creado_en,
  (p.created_at >= now() - make_interval(days => (SELECT dias FROM dias_nuevo))) AS nuevo,
  CASE
    WHEN p.precio_lista_ars IS NOT NULL AND p.precio_final_ars IS NOT NULL AND p.precio_lista_ars > p.precio_final_ars
      THEN floor((1 - p.precio_final_ars / p.precio_lista_ars) * 100)::int
  END                                                           AS ahorro_pct
FROM products p
JOIN publicas pub ON pub.id = p.category_id
WHERE p.active = true;

GRANT SELECT ON tienda_productos TO anon, authenticated;

-- ── Lo más vendido ──────────────────────────────────────────────────────────
-- Unidades de pedidos pagados (o más adelante) de los últimos 28 días, de productos que se
-- ven y tienen stock. Con menos de cuatro productos vendidos, la lista son los destacados;
-- si faltan para llegar al límite, se completa con destacados.
CREATE OR REPLACE FUNCTION tienda_mas_vendidos(p_limite integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite integer := greatest(1, least(coalesce(p_limite, 24), 48));
  v_vendidos integer;
  v_resultado jsonb;
BEGIN
  WITH ventas AS (
    SELECT i.product_id, sum(i.quantity)::int AS unidades
    FROM order_items i
    JOIN orders o ON o.id = i.order_id
    WHERE o.status IN ('pagado', 'preparando', 'enviado', 'entregado')
      AND o.created_at >= now() - interval '28 days'
    GROUP BY i.product_id
  )
  SELECT count(*)::int INTO v_vendidos
  FROM ventas v
  JOIN tienda_productos t ON t.id = v.product_id
  WHERE t.hay_stock;

  WITH ventas AS (
    SELECT i.product_id, sum(i.quantity)::int AS unidades
    FROM order_items i
    JOIN orders o ON o.id = i.order_id
    WHERE o.status IN ('pagado', 'preparando', 'enviado', 'entregado')
      AND o.created_at >= now() - interval '28 days'
    GROUP BY i.product_id
  ),
  candidatos AS (
    SELECT t.*, coalesce(v.unidades, 0) AS unidades
    FROM tienda_productos t
    LEFT JOIN ventas v ON v.product_id = t.id
    WHERE t.hay_stock
      AND (
        (v_vendidos >= 4 AND (v.unidades IS NOT NULL OR t.destacado))
        OR (v_vendidos < 4 AND t.destacado)
      )
    ORDER BY (CASE WHEN v_vendidos >= 4 THEN coalesce(v.unidades, 0) ELSE 0 END) DESC, t.destacado DESC, t.nombre
    LIMIT v_limite
  )
  SELECT jsonb_build_object(
    'origen', CASE WHEN v_vendidos >= 4 THEN 'ventas' ELSE 'destacados' END,
    'productos', coalesce(jsonb_agg(to_jsonb(c) - 'fts' - 'unidades' ORDER BY c.unidades DESC, c.destacado DESC, c.nombre), '[]'::jsonb)
  )
  INTO v_resultado
  FROM candidatos c;

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION tienda_mas_vendidos(integer) TO anon, authenticated;

-- ── Marcas con productos a la vista ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION tienda_marcas()
RETURNS TABLE (id uuid, nombre text, slug text, logo_url text, cantidad integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.name, b.slug, nullif(trim(b.logo_url), ''), count(t.id)::int
  FROM brands b
  JOIN tienda_productos t ON t.marca_id = b.id
  WHERE b.active
  GROUP BY b.id, b.name, b.slug, b.logo_url
  ORDER BY count(t.id) DESC, b.name;
$$;

GRANT EXECUTE ON FUNCTION tienda_marcas() TO anon, authenticated;

-- ── Lo que la portada necesita de la configuración ──────────────────────────
-- El elegido sale solo si su producto se ve en la tienda; la garantía y las cuotas, como número
-- o nulo (la portada pone un marcador). El producto va sin costo ni margen: es una fila de la vista.
CREATE OR REPLACE FUNCTION tienda_portada()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH config AS (
    SELECT
      (SELECT valor FROM tienda_configuracion WHERE clave = 'elegido_semana') AS elegido,
      (SELECT valor FROM tienda_configuracion WHERE clave = 'garantia_meses') AS garantia,
      (SELECT valor FROM tienda_configuracion WHERE clave = 'cuotas_maximas') AS cuotas
  )
  SELECT jsonb_build_object(
    'elegido', (
      SELECT jsonb_build_object(
        'producto', to_jsonb(t) - 'fts',
        'datos', coalesce(c.elegido -> 'datos', '[]'::jsonb),
        'razones', coalesce(c.elegido -> 'razones', '[]'::jsonb),
        'desde', c.elegido ->> 'desde'
      )
      FROM tienda_productos t
      WHERE jsonb_typeof(c.elegido) = 'object'
        AND t.id = (c.elegido ->> 'producto_id')::int
    ),
    'garantia_meses', CASE WHEN jsonb_typeof(c.garantia) = 'number' THEN c.garantia END,
    'cuotas_maximas', CASE WHEN jsonb_typeof(c.cuotas) = 'number' THEN c.cuotas END
  )
  FROM config c;
$$;

GRANT EXECUTE ON FUNCTION tienda_portada() TO anon, authenticated;

-- ── Panel: cargar el elegido de la semana, la garantía y los días de Nuevo ──
-- p_cambios: { "elegido_semana": { "producto_id": 12, "datos": [...4], "razones": [...3] } | null,
--              "garantia_meses": 12 | null, "dias_nuevo": 30 }. Solo cambia las claves presentes.
CREATE OR REPLACE FUNCTION panel_guardar_portada(p_cambios jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_elegido jsonb;
  v_datos jsonb;
  v_razones jsonb;
  v_producto integer;
  v_numero numeric;
BEGIN
  IF lower(coalesce(get_my_role(), '')) <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar la portada';
  END IF;
  IF jsonb_typeof(p_cambios) <> 'object' THEN
    RAISE EXCEPTION 'Faltan los cambios';
  END IF;

  IF p_cambios ? 'elegido_semana' THEN
    v_elegido := p_cambios -> 'elegido_semana';
    IF v_elegido IS NULL OR jsonb_typeof(v_elegido) = 'null' THEN
      v_elegido := 'null'::jsonb;
    ELSE
      IF jsonb_typeof(v_elegido) <> 'object' OR jsonb_typeof(v_elegido -> 'producto_id') <> 'number' THEN
        RAISE EXCEPTION 'El elegido necesita un producto';
      END IF;
      v_producto := (v_elegido ->> 'producto_id')::int;
      IF NOT EXISTS (SELECT 1 FROM tienda_productos WHERE id = v_producto) THEN
        RAISE EXCEPTION 'El producto elegido no está a la vista en la tienda (activo y con categoría)';
      END IF;
      SELECT coalesce(jsonb_agg(trim(x)), '[]'::jsonb) INTO v_datos
      FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(v_elegido -> 'datos') = 'array' THEN v_elegido -> 'datos' ELSE '[]'::jsonb END) AS x
      WHERE trim(x) <> '';
      SELECT coalesce(jsonb_agg(trim(x)), '[]'::jsonb) INTO v_razones
      FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(v_elegido -> 'razones') = 'array' THEN v_elegido -> 'razones' ELSE '[]'::jsonb END) AS x
      WHERE trim(x) <> '';
      IF jsonb_array_length(v_datos) > 4 THEN RAISE EXCEPTION 'Van hasta cuatro datos clave'; END IF;
      IF jsonb_array_length(v_razones) = 0 OR jsonb_array_length(v_razones) > 3 THEN
        RAISE EXCEPTION 'Van de una a tres razones de por qué lo elegimos';
      END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_datos) x WHERE length(x) > 60) THEN
        RAISE EXCEPTION 'Cada dato clave va en 60 caracteres o menos';
      END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_razones) x WHERE length(x) > 180) THEN
        RAISE EXCEPTION 'Cada razón va en 180 caracteres o menos';
      END IF;
      v_elegido := jsonb_build_object('producto_id', v_producto, 'datos', v_datos, 'razones', v_razones, 'desde', to_char(now() AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD'));
    END IF;
    UPDATE tienda_configuracion SET valor = v_elegido, actualizado_en = now(), actualizado_por = auth.uid() WHERE clave = 'elegido_semana';
  END IF;

  IF p_cambios ? 'garantia_meses' THEN
    IF jsonb_typeof(p_cambios -> 'garantia_meses') = 'null' THEN
      UPDATE tienda_configuracion SET valor = 'null'::jsonb, actualizado_en = now(), actualizado_por = auth.uid() WHERE clave = 'garantia_meses';
    ELSE
      v_numero := (p_cambios ->> 'garantia_meses')::numeric;
      IF v_numero IS NULL OR v_numero <> trunc(v_numero) OR v_numero < 1 OR v_numero > 120 THEN
        RAISE EXCEPTION 'La garantía va de 1 a 120 meses';
      END IF;
      UPDATE tienda_configuracion SET valor = to_jsonb(v_numero::int), actualizado_en = now(), actualizado_por = auth.uid() WHERE clave = 'garantia_meses';
    END IF;
  END IF;

  IF p_cambios ? 'dias_nuevo' THEN
    v_numero := (p_cambios ->> 'dias_nuevo')::numeric;
    IF v_numero IS NULL OR v_numero <> trunc(v_numero) OR v_numero < 0 OR v_numero > 365 THEN
      RAISE EXCEPTION 'Los días de Nuevo van de 0 a 365';
    END IF;
    UPDATE tienda_configuracion SET valor = to_jsonb(v_numero::int), actualizado_en = now(), actualizado_por = auth.uid() WHERE clave = 'dias_nuevo';
  END IF;

  RETURN (
    SELECT jsonb_object_agg(clave, valor)
    FROM tienda_configuracion
    WHERE clave IN ('elegido_semana', 'garantia_meses', 'dias_nuevo')
  );
END;
$$;

REVOKE ALL ON FUNCTION panel_guardar_portada(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION panel_guardar_portada(jsonb) TO authenticated;
