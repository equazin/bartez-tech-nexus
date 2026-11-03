-- Portadas "solo imagen": un banner diseñado completo (con el texto adentro de la imagen), con una
-- versión para computadora y otra para celular. El título se usa como texto alternativo.
-- La tienda pasa a mostrar en carrusel todas las portadas activas y vigentes, en orden.

ALTER TABLE portadas DROP CONSTRAINT IF EXISTS portadas_tipo_check;
ALTER TABLE portadas ADD CONSTRAINT portadas_tipo_check CHECK (tipo IN ('banner', 'pc', 'imagen'));

ALTER TABLE portadas ADD COLUMN IF NOT EXISTS imagen_movil_url text;
ALTER TABLE portadas DROP CONSTRAINT IF EXISTS portadas_imagen_movil_url_check;
ALTER TABLE portadas ADD CONSTRAINT portadas_imagen_movil_url_check
  CHECK (imagen_movil_url IS NULL OR ((imagen_movil_url ~ '^https://' OR imagen_movil_url ~ '^/[A-Za-z0-9/_.-]+$') AND length(imagen_movil_url) <= 500));

-- Una portada de solo imagen necesita la imagen de computadora.
ALTER TABLE portadas DROP CONSTRAINT IF EXISTS portadas_imagen_obligatoria;
ALTER TABLE portadas ADD CONSTRAINT portadas_imagen_obligatoria CHECK (tipo <> 'imagen' OR imagen_url IS NOT NULL);

CREATE OR REPLACE VIEW tienda_portadas AS
SELECT p.id, p.tipo, p.etiqueta, p.titulo, p.texto, p.boton, p.enlace, p.imagen_url, p.fondo, p.pc_armada_id, p.orden, p.imagen_movil_url
FROM portadas p
WHERE p.activa
  AND (p.desde IS NULL OR p.desde <= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)
  AND (p.hasta IS NULL OR p.hasta >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)
  AND (p.tipo <> 'pc' OR EXISTS (SELECT 1 FROM tienda_pc_armadas a WHERE a.id = p.pc_armada_id))
ORDER BY p.orden, p.creada_en;

GRANT SELECT ON tienda_portadas TO anon, authenticated;
