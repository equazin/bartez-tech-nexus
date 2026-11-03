-- =============================================================================
-- Teqo · Categorías de la tienda
-- Reemplaza el árbol de Bartez (redes, seguridad, infraestructura, punto de venta...)
-- por el de Teqo: cinco categorías por tipo de producto y subcategorías por uso, como
-- en docs/plan-pagina-y-contenido.md. Las de Bartez quedan inactivas, no se borran:
-- category_mapping y productos viejos pueden apuntarlas. Suma `orden` para que la
-- tienda las muestre en el orden del plan y `descripcion` para el texto de cada
-- página de categoría. Idempotente.
-- =============================================================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS orden       integer NOT NULL DEFAULT 100;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS descripcion text;

UPDATE categories SET active = false
WHERE slug IN ('networking', 'security', 'infrastructure', 'computing', 'storage', 'software', 'accessories', 'uncategorized', 'pos');

-- Las cinco del menú
INSERT INTO categories (name, slug, active, parent_id, orden, descripcion) VALUES
  ('Notebooks',        'notebooks',        true, NULL, 10, 'Configuraciones de fábrica para estudiar, trabajar, crear y jugar. Elegí por uso y presupuesto; el precio es final, con IVA incluido.'),
  ('Gaming',           'gaming',           true, NULL, 20, 'Equipos, pantallas y periféricos elegidos para jugar, con el dato que importa a la vista: Hz, resolución, memoria y precio final.'),
  ('Monitores',        'monitores',        true, NULL, 30, 'De 21,5 a 32 pulgadas, para jugar o para trabajar. Filtrá por pulgadas, frecuencia y panel.'),
  ('Periféricos',      'perifericos',      true, NULL, 40, 'Teclados, mouse, auriculares, parlantes y webcams, con cable o inalámbricos.'),
  ('Accesorios y red', 'accesorios-y-red', true, NULL, 50, 'Almacenamiento externo, hubs, cargadores, fundas y la red de la casa.')
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name, active = true, parent_id = NULL, orden = EXCLUDED.orden,
      descripcion = coalesce(categories.descripcion, EXCLUDED.descripcion);

-- Subcategorías por uso (notebooks y monitores) y por tipo (el resto)
INSERT INTO categories (name, slug, active, parent_id, orden) VALUES
  ('Notebooks para estudiar y trabajar', 'notebooks-para-estudiar-y-trabajar', true, (SELECT id FROM categories WHERE slug = 'notebooks'), 11),
  ('Notebooks gamer',                    'notebooks-gamer',                    true, (SELECT id FROM categories WHERE slug = 'notebooks'), 12),
  ('Notebooks para crear',               'notebooks-para-crear',               true, (SELECT id FROM categories WHERE slug = 'notebooks'), 13),
  ('Notebooks ultralivianas',            'notebooks-ultralivianas',            true, (SELECT id FROM categories WHERE slug = 'notebooks'), 14),

  ('Joysticks y volantes',               'joysticks-y-volantes',               true, (SELECT id FROM categories WHERE slug = 'gaming'), 21),
  ('Streaming',                          'streaming',                          true, (SELECT id FROM categories WHERE slug = 'gaming'), 22),

  ('Monitores para jugar',               'monitores-para-jugar',               true, (SELECT id FROM categories WHERE slug = 'monitores'), 31),
  ('Monitores para trabajar y estudiar', 'monitores-para-trabajar-y-estudiar', true, (SELECT id FROM categories WHERE slug = 'monitores'), 32),
  ('Monitores ultrawide y curvos',       'monitores-ultrawide-y-curvos',       true, (SELECT id FROM categories WHERE slug = 'monitores'), 33),
  ('Soportes de monitor',                'soportes-de-monitor',                true, (SELECT id FROM categories WHERE slug = 'monitores'), 34),

  ('Teclados',                           'teclados',                           true, (SELECT id FROM categories WHERE slug = 'perifericos'), 41),
  ('Mouse',                              'mouse',                              true, (SELECT id FROM categories WHERE slug = 'perifericos'), 42),
  ('Auriculares',                        'auriculares',                        true, (SELECT id FROM categories WHERE slug = 'perifericos'), 43),
  ('Parlantes',                          'parlantes',                          true, (SELECT id FROM categories WHERE slug = 'perifericos'), 44),
  ('Webcams',                            'webcams',                            true, (SELECT id FROM categories WHERE slug = 'perifericos'), 45),
  ('Mousepads',                          'mousepads',                          true, (SELECT id FROM categories WHERE slug = 'perifericos'), 46),
  ('Combos de teclado y mouse',          'combos-de-teclado-y-mouse',          true, (SELECT id FROM categories WHERE slug = 'perifericos'), 47),

  ('SSD externos y pendrives',           'ssd-externos-y-pendrives',           true, (SELECT id FROM categories WHERE slug = 'accesorios-y-red'), 51),
  ('Hubs y adaptadores',                 'hubs-y-adaptadores',                 true, (SELECT id FROM categories WHERE slug = 'accesorios-y-red'), 52),
  ('Cargadores',                         'cargadores',                         true, (SELECT id FROM categories WHERE slug = 'accesorios-y-red'), 53),
  ('Mochilas y fundas',                  'mochilas-y-fundas',                  true, (SELECT id FROM categories WHERE slug = 'accesorios-y-red'), 54),
  ('Routers y Wi-Fi',                    'routers-y-wifi',                     true, (SELECT id FROM categories WHERE slug = 'accesorios-y-red'), 55),
  ('Estabilizadores y UPS',              'estabilizadores-y-ups',              true, (SELECT id FROM categories WHERE slug = 'accesorios-y-red'), 56)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name, active = true, parent_id = EXCLUDED.parent_id, orden = EXCLUDED.orden;

-- La tienda recibe el orden y la descripción; cambia el tipo de retorno, así que se recrea.
DROP FUNCTION IF EXISTS tienda_categorias();
CREATE FUNCTION tienda_categorias()
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
    WHERE p.active = true AND p.category_id IS NOT NULL
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
