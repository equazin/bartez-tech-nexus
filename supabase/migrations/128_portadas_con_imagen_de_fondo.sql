-- Portadas diseñadas: la imagen ocupa toda la portada y el texto va encima (fondos "imagen-*").
-- Las imágenes pueden ser una dirección de la propia tienda (/portadas/...), además de las subidas.

ALTER TABLE portadas DROP CONSTRAINT IF EXISTS portadas_fondo_check;
ALTER TABLE portadas ADD CONSTRAINT portadas_fondo_check
  CHECK (fondo IN ('gris', 'grafito', 'rojo', 'imagen-oscura', 'imagen-clara', 'imagen-roja'));

ALTER TABLE portadas DROP CONSTRAINT IF EXISTS portadas_imagen_url_check;
ALTER TABLE portadas ADD CONSTRAINT portadas_imagen_url_check
  CHECK (imagen_url IS NULL OR ((imagen_url ~ '^https://' OR imagen_url ~ '^/[A-Za-z0-9/_.-]+$') AND length(imagen_url) <= 500));
