-- =============================================================================
-- Teqo · PC y componentes, y consolas
-- Nico decidió el 3/11/2026 que la tienda también vende componentes, mini PC y
-- consolas. Suma la categoría "PC y componentes" al menú con sus subcategorías,
-- "Consolas" dentro de Gaming, y el mapeo de las categorías de ELIT que la 119 había
-- dejado afuera a propósito. El trigger trg_tienda_aplicar_mapeo (118) asigna la
-- categoría a los productos que todavía no tienen. Idempotente.
-- =============================================================================

-- 1. Categoría del menú
INSERT INTO categories (name, slug, active, parent_id, orden, descripcion) VALUES
  ('PC y componentes', 'pc-y-componentes', true, NULL, 60,
   'Procesadores, motherboards, placas de video, memorias, discos internos, fuentes, gabinetes y refrigeración para armar tu PC, y mini PC listas para usar.')
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name, active = true, parent_id = NULL, orden = EXCLUDED.orden,
      descripcion = coalesce(categories.descripcion, EXCLUDED.descripcion);

-- 2. Subcategorías
INSERT INTO categories (name, slug, active, parent_id, orden) VALUES
  ('Consolas',                'consolas',                true, (SELECT id FROM categories WHERE slug = 'gaming'), 23),

  ('Mini PC',                 'mini-pc',                 true, (SELECT id FROM categories WHERE slug = 'pc-y-componentes'), 61),
  ('Procesadores',            'procesadores',            true, (SELECT id FROM categories WHERE slug = 'pc-y-componentes'), 62),
  ('Motherboards',            'motherboards',            true, (SELECT id FROM categories WHERE slug = 'pc-y-componentes'), 63),
  ('Placas de video',         'placas-de-video',         true, (SELECT id FROM categories WHERE slug = 'pc-y-componentes'), 64),
  ('Memorias RAM',            'memorias-ram',            true, (SELECT id FROM categories WHERE slug = 'pc-y-componentes'), 65),
  ('Discos internos',         'discos-internos',         true, (SELECT id FROM categories WHERE slug = 'pc-y-componentes'), 66),
  ('Fuentes',                 'fuentes',                 true, (SELECT id FROM categories WHERE slug = 'pc-y-componentes'), 67),
  ('Gabinetes',               'gabinetes',               true, (SELECT id FROM categories WHERE slug = 'pc-y-componentes'), 68),
  ('Coolers y refrigeración', 'coolers-y-refrigeracion', true, (SELECT id FROM categories WHERE slug = 'pc-y-componentes'), 69)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name, active = true, parent_id = EXCLUDED.parent_id, orden = EXCLUDED.orden;

-- 3. Mapeo de ELIT ("Rubro / Subrubro")
INSERT INTO category_mapping (supplier_id, external_category_id, external_category_name, internal_category_id, confidence)
SELECT s.id, m.externa, m.externa, c.id, 'manual'
FROM (VALUES
  ('Hardware / Fuentes',                   'fuentes'),
  ('Hardware / Procesadores',              'procesadores'),
  ('Hardware / Coolers',                   'coolers-y-refrigeracion'),
  ('Hardware / Motherboards',              'motherboards'),
  ('Hardware / Placas de Video',           'placas-de-video'),
  ('Hardware / Gabinetes',                 'gabinetes'),
  ('Memorias / Memorias PC',               'memorias-ram'),
  ('Memorias / Memorias Notebook',         'memorias-ram'),
  ('Almacenamiento / Discos Internos SSD', 'discos-internos'),
  ('Almacenamiento / Discos Internos',     'discos-internos'),
  ('Computadoras / Mini PC',               'mini-pc'),
  ('Video Juegos / Consolas',              'consolas')
) AS m(externa, slug)
JOIN suppliers s ON lower(s.name) = 'elit'
JOIN categories c ON c.slug = m.slug
ON CONFLICT (supplier_id, external_category_id) DO UPDATE
  SET internal_category_id = EXCLUDED.internal_category_id,
      external_category_name = EXCLUDED.external_category_name,
      confidence = 'manual',
      updated_at = now();

-- 4. Productos que hayan quedado sin categoría (por si el trigger no los alcanzó)
UPDATE products SET category_id = tienda_categoria_para(category)
WHERE category_id IS NULL AND coalesce(trim(category), '') <> '';

SELECT recalcular_precios();
