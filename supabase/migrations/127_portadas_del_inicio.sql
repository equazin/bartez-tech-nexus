-- Portada del inicio, editable desde el panel (Marketing › Portada del inicio).
--
-- Cada portada es un banner con texto o una PC armada. La tienda muestra la primera activa y dentro
-- de sus fechas (hora de Argentina); si no hay ninguna, la primera PC armada. Las imágenes subidas
-- van al espacio público "portadas"; también se puede usar la foto de un producto.

CREATE TABLE IF NOT EXISTS portadas (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text        NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 80),
  tipo           text        NOT NULL CHECK (tipo IN ('banner', 'pc')),
  etiqueta       text        NOT NULL DEFAULT '' CHECK (length(etiqueta) <= 60),
  titulo         text        NOT NULL DEFAULT '' CHECK (length(titulo) <= 80),
  texto          text        NOT NULL DEFAULT '' CHECK (length(texto) <= 240),
  boton          text        NOT NULL DEFAULT '' CHECK (length(boton) <= 40),
  -- Adónde lleva el botón: siempre una dirección de la tienda (/ofertas, /notebooks, /arma-tu-pc...).
  destino_tipo   text        NOT NULL DEFAULT 'ofertas' CHECK (destino_tipo IN ('ofertas', 'categoria', 'producto', 'armador')),
  enlace         text        NOT NULL DEFAULT '/ofertas' CHECK (enlace ~ '^/[A-Za-z0-9/_?=&.-]*$' AND length(enlace) <= 200),
  imagen_url     text        CHECK (imagen_url IS NULL OR (imagen_url ~ '^https://' AND length(imagen_url) <= 500)),
  foto_producto_id integer,
  fondo          text        NOT NULL DEFAULT 'gris' CHECK (fondo IN ('gris', 'grafito', 'rojo')),
  pc_armada_id   uuid        REFERENCES pc_armadas(id) ON DELETE SET NULL,
  desde          date,
  hasta          date,
  activa         boolean     NOT NULL DEFAULT false,
  orden          integer     NOT NULL DEFAULT 0,
  creada_en      timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now(),
  CHECK (hasta IS NULL OR desde IS NULL OR hasta >= desde),
  CHECK (tipo = 'pc' OR length(trim(titulo)) > 0)
);

ALTER TABLE portadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portadas_admin ON portadas;
CREATE POLICY portadas_admin ON portadas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'));

-- Las vigentes, en orden: la tienda toma la primera. Una de PC armada vale solo si esa PC se ve en la tienda.
CREATE OR REPLACE VIEW tienda_portadas AS
SELECT p.id, p.tipo, p.etiqueta, p.titulo, p.texto, p.boton, p.enlace, p.imagen_url, p.fondo, p.pc_armada_id, p.orden
FROM portadas p
WHERE p.activa
  AND (p.desde IS NULL OR p.desde <= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)
  AND (p.hasta IS NULL OR p.hasta >= (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date)
  AND (p.tipo = 'banner' OR EXISTS (SELECT 1 FROM tienda_pc_armadas a WHERE a.id = p.pc_armada_id))
ORDER BY p.orden, p.creada_en;

GRANT SELECT ON tienda_portadas TO anon, authenticated;

-- Imágenes de las portadas: lectura pública, solo los administradores suben, cambian o borran.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('portadas', 'portadas', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS portadas_admin_subir ON storage.objects;
CREATE POLICY portadas_admin_subir ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portadas' AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'));
DROP POLICY IF EXISTS portadas_admin_cambiar ON storage.objects;
CREATE POLICY portadas_admin_cambiar ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'portadas' AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'));
DROP POLICY IF EXISTS portadas_admin_borrar ON storage.objects;
CREATE POLICY portadas_admin_borrar ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'portadas' AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND lower(p.role) = 'admin'));
