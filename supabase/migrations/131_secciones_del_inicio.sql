-- Secciones del inicio, editables desde el panel (Marketing › Secciones del inicio): cuáles se
-- muestran, en qué orden y con qué productos. Sin filas, la tienda usa el inicio de siempre.
--
-- config según el tipo:
--   productos / componentes: { fuente: mano|destacados|categoria, categoria, orden, formato: grilla|carrusel, cantidad, ids, pestanas }
--   comparador:              { categoria, ids }
--   categorias:              { slugs }            (vacío: las de siempre)
--   elegido:                 { producto_id }      (vacío: el primero destacado)

CREATE TABLE IF NOT EXISTS secciones_inicio (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo           text        NOT NULL CHECK (tipo IN ('portada', 'categorias', 'productos', 'elegido', 'componentes', 'comparador', 'por_uso', 'marcas', 'ayuda')),
  titulo         text        NOT NULL DEFAULT '' CHECK (length(titulo) <= 80),
  bajada         text        NOT NULL DEFAULT '' CHECK (length(bajada) <= 160),
  activa         boolean     NOT NULL DEFAULT true,
  orden          integer     NOT NULL DEFAULT 0,
  config         jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  creada_en      timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE secciones_inicio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS secciones_inicio_admin ON secciones_inicio;
CREATE POLICY secciones_inicio_admin ON secciones_inicio FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'));

CREATE OR REPLACE VIEW tienda_secciones_inicio AS
SELECT id, tipo, titulo, bajada, orden, config
FROM secciones_inicio
WHERE activa
ORDER BY orden, creada_en;

GRANT SELECT ON tienda_secciones_inicio TO anon, authenticated;

-- El inicio de siempre, como punto de partida.
INSERT INTO secciones_inicio (tipo, titulo, bajada, orden, config)
SELECT v.tipo, v.titulo, v.bajada, v.orden, v.config::jsonb
FROM (VALUES
  ('portada', 'Portada', '', 1, '{}'),
  ('categorias', 'Qué estás buscando', '', 2, '{"slugs": []}'),
  ('productos', 'Destacados', 'Elegidos por el equipo de Teqo esta semana.', 3, '{"fuente": "destacados", "formato": "grilla", "cantidad": 6, "pestanas": true}'),
  ('elegido', 'Elegido de la semana', '', 4, '{}'),
  ('componentes', 'PC y componentes', '', 5, '{"fuente": "categoria", "categoria": "pc-y-componentes", "orden": "destacados", "formato": "grilla", "cantidad": 4}'),
  ('por_uso', 'Por uso', '', 6, '{}'),
  ('productos', 'Notebooks', '', 7, '{"fuente": "categoria", "categoria": "notebooks", "orden": "destacados", "formato": "grilla", "cantidad": 5}'),
  ('comparador', 'Tres monitores, lado a lado.', '', 8, '{"categoria": "monitores-para-jugar"}'),
  ('productos', 'Periféricos', '', 9, '{"fuente": "categoria", "categoria": "perifericos", "orden": "destacados", "formato": "grilla", "cantidad": 6}'),
  ('marcas', 'Marcas', '', 10, '{}'),
  ('ayuda', 'Ayuda', '', 11, '{}')
) AS v(tipo, titulo, bajada, orden, config)
WHERE NOT EXISTS (SELECT 1 FROM secciones_inicio);
