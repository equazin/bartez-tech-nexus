-- El botón o el banner de una portada también puede llevar a una búsqueda (/buscar?q=Logitech),
-- por ejemplo para los banners de marca.

ALTER TABLE portadas DROP CONSTRAINT IF EXISTS portadas_destino_tipo_check;
ALTER TABLE portadas ADD CONSTRAINT portadas_destino_tipo_check CHECK (destino_tipo IN ('ofertas', 'categoria', 'producto', 'armador', 'busqueda'));

ALTER TABLE portadas DROP CONSTRAINT IF EXISTS portadas_enlace_check;
ALTER TABLE portadas ADD CONSTRAINT portadas_enlace_check CHECK (enlace ~ '^/[A-Za-z0-9/_?=&.%+-]*$' AND length(enlace) <= 200);
