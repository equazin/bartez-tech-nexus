-- =============================================================================
-- Teqo · Categorías nuevas (3/11/2026)
--
-- 1. Sim racing: categoría propia en el primer nivel (aparece en el menú junto a Gaming),
--    con volantes y pedaleras, cockpits y bases, y accesorios.
-- 2. Categorías para lo que trajo New Bytes y no tenía lugar: impresoras, Smart TV,
--    pantallas y soportes para proyector, sillas y escritorios, y soportes para celular y tablet.
-- 3. Joysticks y volantes pasa a llamarse Joysticks y gamepads (los volantes van a Sim racing);
--    el slug no cambia para no romper enlaces.
-- 4. Mapeo de las categorías de New Bytes a las de Teqo, para que lo que entre después
--    quede en su categoría (tienda_categoria_para lee category_mapping).
-- Idempotente.
-- =============================================================================

-- 1 y 2. Categorías
INSERT INTO categories (name, slug, active, parent_id, orden, descripcion)
SELECT 'Sim racing', 'sim-racing', true, NULL, 25,
       'Volantes, pedaleras, cockpits y accesorios para correr en la PC o la consola, con precio final e IVA incluido.'
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'sim-racing');

INSERT INTO categories (name, slug, active, parent_id, orden, descripcion)
SELECT v.nombre, v.slug, true, (SELECT id FROM categories WHERE slug = v.padre), v.orden, NULL
FROM (VALUES
  ('Volantes y pedaleras',                 'volantes-y-pedaleras',                 'sim-racing',       26),
  ('Cockpits y bases',                     'cockpits-y-bases',                     'sim-racing',       27),
  ('Accesorios para sim racing',           'accesorios-para-sim-racing',           'sim-racing',       28),
  ('Sillas y escritorios',                 'sillas-y-escritorios',                 'gaming',           24),
  ('Smart TV',                             'smart-tv',                             'monitores',        35),
  ('Pantallas y soportes para proyector',  'pantallas-y-soportes-para-proyector',  'monitores',        36),
  ('Impresoras',                           'impresoras',                           'perifericos',      48),
  ('Soportes para celular y tablet',       'soportes-para-celular-y-tablet',       'accesorios-y-red', 57)
) AS v(nombre, slug, padre, orden)
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.slug = v.slug);

-- 3. Joysticks sin volantes
UPDATE categories SET name = 'Joysticks y gamepads' WHERE slug = 'joysticks-y-volantes' AND name = 'Joysticks y volantes';

-- 4. Categorías de New Bytes → Teqo
INSERT INTO category_mapping (supplier_id, external_category_id, external_category_name, internal_category_id, confidence)
SELECT s.id, v.externa, v.externa, c.id, 'manual'
FROM (VALUES
  ('PROCESADORES', 'procesadores'), ('PLACA DE VIDEO', 'placas-de-video'), ('MEMORIAS', 'memorias-ram'),
  ('DISCOS SSD', 'discos-internos'), ('DISCOS HDD', 'discos-internos'), ('MOTHER GIGABYTE', 'motherboards'),
  ('MOTHER ASUS', 'motherboards'), ('MOTHER ASROCK', 'motherboards'), ('MOTHER MSI', 'motherboards'),
  ('FUENTES', 'fuentes'), ('COOLERS', 'coolers-y-refrigeracion'), ('GABINETE GAMER', 'gabinetes'),
  ('MONITORES', 'monitores'), ('NOTEBOOKS Y PORTATILES', 'notebooks-para-estudiar-y-trabajar'), ('TECLADOS', 'teclados'),
  ('MOUSES', 'mouse'), ('MOUSEPADS', 'mousepads'), ('AURICULARES', 'auriculares'), ('MICROFONOS', 'streaming'),
  ('WEBCAMS', 'webcams'), ('JOYSTICKS', 'joysticks-y-volantes'), ('UPS Y ESTABILIZADORES', 'estabilizadores-y-ups'),
  ('SOPORTES', 'soportes-de-monitor'), ('SILLAS GAMER - ESCRITORIOS GAMERS', 'sillas-y-escritorios'),
  ('IMPRESORAS', 'impresoras'), ('TELEVISORES', 'smart-tv')
) AS v(externa, slug)
JOIN categories c ON c.slug = v.slug
CROSS JOIN (SELECT id FROM suppliers WHERE lower(replace(trim(name), ' ', '')) = 'newbytes' LIMIT 1) s
WHERE NOT EXISTS (
  SELECT 1 FROM category_mapping m WHERE m.supplier_id = s.id AND m.external_category_name = v.externa
);
