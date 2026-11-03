-- =============================================================================
-- Teqo · Plan de página y contenido · Fase A · Categorías de la tienda
-- (docs/plan-pagina-y-contenido.md, secciones 4 y 7)
--
-- - El árbol de Teqo: Notebooks, Gaming, Monitores, Periféricos y Accesorios y red, con
--   subcategorías por uso. Se desactivan las nueve categorías heredadas de Bartez.
-- - Gaming es una vista transversal: lista sus propias subcategorías y todo lo que lleva la
--   etiqueta "gaming", que se pone a mano (products.tags) o se hereda de la categoría (un
--   producto en Notebooks › Gamer o en Monitores › Para jugar ya cuenta como gaming).
-- - El panel y las sincronizaciones guardan la categoría como texto (products.category). Un
--   disparador la traduce a products.category_id, que es lo que usa la tienda: primero por el
--   mapeo de categorías de los mayoristas (mapeo_categorias, editable desde el panel), después
--   por el nombre o el slug de una categoría activa. El texto que llegó se conserva en
--   products.categoria_origen para poder mapearlo después.
-- - La tienda muestra solo productos con una categoría activa: lo que entra de un mayorista sin
--   mapear queda en el panel hasta que alguien le asigna categoría.
-- Idempotente.
-- =============================================================================

-- ── Columnas nuevas de categories ───────────────────────────────────────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS orden             integer NOT NULL DEFAULT 100;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS nombre_corto      text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS etiqueta_heredada text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS incluye_etiqueta  text;

COMMENT ON COLUMN categories.orden IS 'Orden en el menú y entre hermanas (menor primero).';
COMMENT ON COLUMN categories.nombre_corto IS 'Nombre para el chip dentro de su categoría madre (por ejemplo, "Gamer" dentro de Notebooks).';
COMMENT ON COLUMN categories.etiqueta_heredada IS 'Los productos de esta categoría y de sus hijas llevan esta etiqueta en la tienda (por ejemplo, gaming).';
COMMENT ON COLUMN categories.incluye_etiqueta IS 'Vista transversal: además de su rama, la categoría lista los productos con esta etiqueta (Gaming).';

ALTER TABLE products ADD COLUMN IF NOT EXISTS categoria_origen text;
COMMENT ON COLUMN products.categoria_origen IS 'La categoría tal como llegó del mayorista, la planilla o el panel, antes de traducirla a una categoría de Teqo.';

-- ── El árbol de Teqo ────────────────────────────────────────────────────────
-- Nombre completo (único, se lee solo en migas, títulos y el panel) y nombre corto para el chip.
-- Los slugs siguen la convención del panel: el de la madre, un guion y el propio.
DO $$
DECLARE
  fila record;
  v_id bigint;
  v_padre bigint;
BEGIN
  FOR fila IN
    SELECT * FROM (VALUES
      -- slug,                                   nombre,                                madre,         corto,                      orden, hereda,   incluye
      ('notebooks',                              'Notebooks',                           NULL,          NULL,                        10,   NULL,     NULL),
      ('notebooks-para-estudiar-y-trabajar',     'Notebooks para estudiar y trabajar',  'notebooks',   'Para estudiar y trabajar',  10,   NULL,     NULL),
      ('notebooks-gamer',                        'Notebooks gamer',                     'notebooks',   'Gamer',                     20,   'gaming', NULL),
      ('notebooks-para-crear',                   'Notebooks para crear',                'notebooks',   'Para crear',                30,   NULL,     NULL),
      ('notebooks-ultralivianas',                'Notebooks ultralivianas',             'notebooks',   'Ultralivianas',             40,   NULL,     NULL),
      ('gaming',                                 'Gaming',                              NULL,          NULL,                        20,   'gaming', 'gaming'),
      ('gaming-joysticks-y-volantes',            'Joysticks y volantes',                'gaming',      NULL,                        10,   NULL,     NULL),
      ('gaming-streaming',                       'Streaming',                           'gaming',      NULL,                        20,   NULL,     NULL),
      ('monitores',                              'Monitores',                           NULL,          NULL,                        30,   NULL,     NULL),
      ('monitores-para-jugar',                   'Monitores para jugar',                'monitores',   'Para jugar',                10,   'gaming', NULL),
      ('monitores-para-trabajar-y-estudiar',     'Monitores para trabajar y estudiar',  'monitores',   'Para trabajar y estudiar',  20,   NULL,     NULL),
      ('monitores-ultrawide-y-curvos',           'Monitores ultrawide y curvos',        'monitores',   'Ultrawide y curvos',        30,   NULL,     NULL),
      ('monitores-soportes',                     'Soportes de monitor',                 'monitores',   'Soportes',                  40,   NULL,     NULL),
      ('perifericos',                            'Periféricos',                         NULL,          NULL,                        40,   NULL,     NULL),
      ('perifericos-teclados',                   'Teclados',                            'perifericos', NULL,                        10,   NULL,     NULL),
      ('perifericos-mouse',                      'Mouse',                               'perifericos', NULL,                        20,   NULL,     NULL),
      ('perifericos-auriculares',                'Auriculares',                         'perifericos', NULL,                        30,   NULL,     NULL),
      ('perifericos-parlantes',                  'Parlantes',                           'perifericos', NULL,                        40,   NULL,     NULL),
      ('perifericos-webcams',                    'Webcams',                             'perifericos', NULL,                        50,   NULL,     NULL),
      ('perifericos-mousepads',                  'Mousepads',                           'perifericos', NULL,                        60,   NULL,     NULL),
      ('perifericos-combos',                     'Combos de teclado y mouse',           'perifericos', 'Combos',                    70,   NULL,     NULL),
      ('accesorios',                             'Accesorios y red',                    NULL,          NULL,                        50,   NULL,     NULL),
      ('accesorios-ssd-externos-y-pendrives',    'SSD externos y pendrives',            'accesorios',  NULL,                        10,   NULL,     NULL),
      ('accesorios-hubs-y-adaptadores',          'Hubs y adaptadores',                  'accesorios',  NULL,                        20,   NULL,     NULL),
      ('accesorios-cargadores',                  'Cargadores',                          'accesorios',  NULL,                        30,   NULL,     NULL),
      ('accesorios-mochilas-y-fundas',           'Mochilas y fundas',                   'accesorios',  NULL,                        40,   NULL,     NULL),
      ('accesorios-routers-y-wifi',              'Routers y Wi-Fi',                     'accesorios',  NULL,                        50,   NULL,     NULL),
      ('accesorios-estabilizadores-y-ups',       'Estabilizadores y UPS',               'accesorios',  NULL,                        60,   NULL,     NULL)
    ) AS t(slug, nombre, madre, corto, orden, hereda, incluye)
  LOOP
    v_padre := NULL;
    IF fila.madre IS NOT NULL THEN
      SELECT id INTO v_padre FROM categories WHERE slug = fila.madre;
    END IF;

    -- Si ya existe por slug, o por nombre (alguien la creó a mano desde el panel), se reusa.
    SELECT id INTO v_id FROM categories WHERE slug = fila.slug;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM categories WHERE lower(trim(name)) = lower(trim(fila.nombre)) ORDER BY id LIMIT 1;
    END IF;

    IF v_id IS NULL THEN
      INSERT INTO categories (name, slug, active, parent_id, orden, nombre_corto, etiqueta_heredada, incluye_etiqueta)
      VALUES (fila.nombre, fila.slug, true, v_padre, fila.orden, fila.corto, fila.hereda, fila.incluye);
    ELSE
      UPDATE categories
      SET name = fila.nombre,
          slug = fila.slug,
          active = true,
          parent_id = v_padre,
          orden = fila.orden,
          nombre_corto = fila.corto,
          etiqueta_heredada = fila.hereda,
          incluye_etiqueta = fila.incluye
      WHERE id = v_id;
    END IF;
  END LOOP;
END $$;

-- Las nueve categorías de Bartez quedan para el historial pero salen de la tienda.
UPDATE categories
SET active = false
WHERE slug IN ('networking', 'security', 'infrastructure', 'computing', 'storage', 'software', 'accessories', 'uncategorized', 'pos');

-- ── Texto normalizado: minúsculas, sin acentos y sin espacios de más ────────
CREATE OR REPLACE FUNCTION tienda_normalizar(texto text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(trim(regexp_replace(lower(unaccent(coalesce(texto, ''))), '\s+', ' ', 'g')), '');
$$;

-- ── Mapeo de categorías de los mayoristas ───────────────────────────────────
-- Una fila por texto de categoría que llega de afuera ("NOTEBOOKS", "Computadoras / Monitores"),
-- sin importar el mayorista. category_mapping (por proveedor e id externo) sigue existiendo para
-- el script de AIR; el panel y la importación usan esta tabla.
CREATE TABLE IF NOT EXISTS mapeo_categorias (
  origen          text PRIMARY KEY,
  origen_visto    text NOT NULL,
  categoria_id    bigint NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE mapeo_categorias IS 'Texto de categoría de un mayorista o planilla (normalizado) → categoría de Teqo.';

ALTER TABLE mapeo_categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mapeo_categorias_panel ON mapeo_categorias;
CREATE POLICY mapeo_categorias_panel ON mapeo_categorias FOR ALL TO authenticated
  USING (lower(get_my_role()) IN ('admin', 'vendedor', 'sales'))
  WITH CHECK (lower(get_my_role()) IN ('admin', 'vendedor', 'sales'));
REVOKE ALL ON mapeo_categorias FROM anon;

-- ── Texto de categoría → categoría de Teqo ──────────────────────────────────
CREATE OR REPLACE FUNCTION tienda_resolver_categoria(p_texto text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT m.categoria_id FROM mapeo_categorias m WHERE m.origen = tienda_normalizar(p_texto)),
    (SELECT c.id FROM categories c WHERE c.active AND tienda_normalizar(c.name) = tienda_normalizar(p_texto) ORDER BY c.id LIMIT 1),
    (SELECT c.id FROM categories c WHERE c.active AND c.slug = nullif(tienda_slug(p_texto), '') ORDER BY c.id LIMIT 1)
  );
$$;

-- ── products.category (texto) y products.category_id, siempre de acuerdo ────
-- Si cambia el id, el texto pasa a ser el nombre de la categoría. Si cambia el texto, se
-- traduce a un id; si no hay traducción, el id queda vacío y el texto se guarda como origen.
CREATE OR REPLACE FUNCTION tienda_sincronizar_categoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id     bigint;
  v_nombre text;
  cambia_id    boolean;
  cambia_texto boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    cambia_id := NEW.category_id IS NOT NULL;
    cambia_texto := NOT cambia_id AND NEW.category IS NOT NULL;
  ELSE
    cambia_id := NEW.category_id IS DISTINCT FROM OLD.category_id;
    cambia_texto := NOT cambia_id AND NEW.category IS DISTINCT FROM OLD.category;
  END IF;

  IF cambia_id THEN
    IF NEW.category_id IS NOT NULL THEN
      SELECT name INTO v_nombre FROM categories WHERE id = NEW.category_id;
      IF v_nombre IS NOT NULL THEN
        IF NEW.category IS NOT NULL AND tienda_normalizar(NEW.category) IS DISTINCT FROM tienda_normalizar(v_nombre) THEN
          NEW.categoria_origen := coalesce(NEW.categoria_origen, NEW.category);
        END IF;
        NEW.category := v_nombre;
      END IF;
    END IF;
  ELSIF cambia_texto THEN
    v_id := tienda_resolver_categoria(NEW.category);
    IF v_id IS NULL THEN
      NEW.category_id := NULL;
      NEW.categoria_origen := NEW.category;
    ELSE
      SELECT name INTO v_nombre FROM categories WHERE id = v_id;
      -- Se guarda el origen solo si vino de un mapeo; un nombre o slug de Teqo no es un origen.
      IF EXISTS (SELECT 1 FROM mapeo_categorias m WHERE m.origen = tienda_normalizar(NEW.category)) THEN
        NEW.categoria_origen := NEW.category;
      END IF;
      NEW.category_id := v_id;
      NEW.category := v_nombre;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Los disparadores BEFORE corren en orden alfabético: este (categoria) va antes que el del precio
-- (precio), así el margen por categoría se calcula con la categoría ya traducida.
DROP TRIGGER IF EXISTS trg_tienda_categoria_sincronizar ON products;
CREATE TRIGGER trg_tienda_categoria_sincronizar
  BEFORE INSERT OR UPDATE OF category, category_id ON products
  FOR EACH ROW EXECUTE FUNCTION tienda_sincronizar_categoria();

-- El precio se recalcula también cuando cambia solo category_id (un mapeo nuevo o un
-- producto movido de categoría por id), porque el margen puede depender de la categoría.
DROP TRIGGER IF EXISTS trg_tienda_precio_en_el_producto ON products;
CREATE TRIGGER trg_tienda_precio_en_el_producto
  BEFORE INSERT OR UPDATE OF cost_price, supplier_multiplier, special_price, offer_percent, iva_rate,
                             primary_supplier_id, category, category_id, tags, sku, precio_manual ON products
  FOR EACH ROW EXECUTE FUNCTION tienda_precio_en_el_producto();

-- Al guardar un mapeo, los productos con ese origen que todavía no tenían categoría (o que tenían
-- la del mapeo anterior) pasan a la nueva. Un producto movido a mano en el panel no se toca.
CREATE OR REPLACE FUNCTION tienda_aplicar_mapeo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products p
  SET category_id = NEW.categoria_id
  WHERE tienda_normalizar(p.categoria_origen) = NEW.origen
    AND p.category_id IS DISTINCT FROM NEW.categoria_id
    AND (p.category_id IS NULL OR (TG_OP = 'UPDATE' AND p.category_id = OLD.categoria_id));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tienda_aplicar_mapeo ON mapeo_categorias;
CREATE TRIGGER trg_tienda_aplicar_mapeo
  AFTER INSERT OR UPDATE OF categoria_id ON mapeo_categorias
  FOR EACH ROW EXECUTE FUNCTION tienda_aplicar_mapeo();

-- ── Panel: guardar un mapeo y ver qué textos de origen hay ──────────────────
CREATE OR REPLACE FUNCTION panel_mapear_categoria(p_texto text, p_categoria_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_origen text := tienda_normalizar(p_texto);
  v_movidos integer;
BEGIN
  IF lower(coalesce(get_my_role(), '')) NOT IN ('admin', 'vendedor', 'sales') THEN
    RAISE EXCEPTION 'Solo el panel puede mapear categorías';
  END IF;
  IF v_origen IS NULL THEN
    RAISE EXCEPTION 'Falta el texto de origen';
  END IF;

  IF p_categoria_id IS NULL THEN
    DELETE FROM mapeo_categorias WHERE origen = v_origen;
    RETURN 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM categories WHERE id = p_categoria_id AND active) THEN
    RAISE EXCEPTION 'La categoría elegida no existe o no está activa';
  END IF;

  INSERT INTO mapeo_categorias (origen, origen_visto, categoria_id, actualizado_por)
  VALUES (v_origen, trim(p_texto), p_categoria_id, auth.uid())
  ON CONFLICT (origen) DO UPDATE
    SET categoria_id = EXCLUDED.categoria_id, actualizado_en = now(), actualizado_por = EXCLUDED.actualizado_por;

  SELECT count(*)::int INTO v_movidos FROM products WHERE tienda_normalizar(categoria_origen) = v_origen AND category_id = p_categoria_id;
  RETURN v_movidos;
END;
$$;

REVOKE ALL ON FUNCTION panel_mapear_categoria(text, bigint) FROM public, anon;
GRANT EXECUTE ON FUNCTION panel_mapear_categoria(text, bigint) TO authenticated;

-- Los textos de origen de los productos, con cuántos hay y a dónde van. Corre con la sesión
-- del panel: para cualquier otra cuenta, las políticas de products devuelven cero filas.
CREATE OR REPLACE FUNCTION panel_categorias_de_origen()
RETURNS TABLE (origen text, texto text, productos integer, activos integer, sin_categoria integer, categoria_id bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT g.origen, g.texto, g.productos, g.activos, g.sin_categoria, m.categoria_id
  FROM (
    SELECT
      tienda_normalizar(p.categoria_origen)              AS origen,
      min(p.categoria_origen)                            AS texto,
      count(*)::int                                      AS productos,
      count(*) FILTER (WHERE p.active)::int              AS activos,
      count(*) FILTER (WHERE p.category_id IS NULL)::int AS sin_categoria
    FROM products p
    WHERE tienda_normalizar(p.categoria_origen) IS NOT NULL
    GROUP BY 1
  ) g
  LEFT JOIN mapeo_categorias m ON m.origen = g.origen
  ORDER BY g.sin_categoria DESC, g.productos DESC, g.origen;
$$;

REVOKE ALL ON FUNCTION panel_categorias_de_origen() FROM public, anon;
GRANT EXECUTE ON FUNCTION panel_categorias_de_origen() TO authenticated;

-- ── Los productos que ya estaban: se traducen con las reglas de arriba ──────
UPDATE products
SET categoria_origen = category
WHERE categoria_origen IS NULL
  AND category IS NOT NULL
  AND (category_id IS NULL OR NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = products.category_id AND c.active));

UPDATE products p
SET category_id = r.id
FROM (
  SELECT id AS producto, tienda_resolver_categoria(categoria_origen) AS id
  FROM products
  WHERE categoria_origen IS NOT NULL
) r
WHERE r.producto = p.id
  AND r.id IS NOT NULL
  AND (p.category_id IS NULL OR NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = p.category_id AND c.active));

-- ── La vista pública: solo productos con una categoría activa, y sus etiquetas ──
-- publicas: las categorías activas cuya cadena de madres también está activa, con las
-- etiquetas que heredan. Se calcula una vez por consulta (son decenas de filas).
CREATE OR REPLACE VIEW tienda_productos AS
WITH RECURSIVE publicas AS (
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
  )                                                             AS etiquetas
FROM products p
JOIN publicas pub ON pub.id = p.category_id
WHERE p.active = true;

GRANT SELECT ON tienda_productos TO anon, authenticated;

-- ── Categorías públicas: orden del menú, nombre corto y vista transversal ───
-- La cantidad cuenta los productos visibles de su rama y, si es una vista transversal,
-- también los que llevan su etiqueta (sin contar dos veces).
DROP FUNCTION IF EXISTS tienda_categorias();
CREATE FUNCTION tienda_categorias()
RETURNS TABLE (
  id bigint,
  nombre text,
  slug text,
  padre_id bigint,
  cantidad int,
  nombre_corto text,
  orden int,
  incluye_etiqueta text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE publicas AS (
    SELECT c.id, 1 AS nivel FROM categories c WHERE c.active AND c.parent_id IS NULL
    UNION ALL
    SELECT c.id, pub.nivel + 1 FROM categories c JOIN publicas pub ON c.parent_id = pub.id WHERE c.active AND pub.nivel < 10
  ),
  rama AS (
    SELECT pub.id AS descendiente, pub.id AS ancestro FROM publicas pub
    UNION ALL
    SELECT r.descendiente, c.parent_id
    FROM rama r
    JOIN categories c ON c.id = r.ancestro
    WHERE c.parent_id IS NOT NULL
  ),
  visibles AS (
    SELECT t.id, t.categoria_id, t.etiquetas FROM tienda_productos t
  )
  SELECT
    c.id,
    c.name,
    c.slug,
    c.parent_id,
    (
      SELECT count(*)::int
      FROM visibles v
      WHERE v.categoria_id IN (SELECT r.descendiente FROM rama r WHERE r.ancestro = c.id)
         OR (nullif(trim(c.incluye_etiqueta), '') IS NOT NULL AND lower(trim(c.incluye_etiqueta)) = ANY (v.etiquetas))
    ),
    coalesce(nullif(trim(c.nombre_corto), ''), c.name),
    c.orden,
    lower(nullif(trim(c.incluye_etiqueta), ''))
  FROM categories c
  JOIN publicas pub ON pub.id = c.id
  ORDER BY c.orden, c.name;
$$;

GRANT EXECUTE ON FUNCTION tienda_categorias() TO anon, authenticated;
