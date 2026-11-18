-- 147: la cotización del envío queda guardada unos minutos.
--
-- Confirmar la compra tardaba de 10 a 14 segundos: el servidor volvía a consultar al correo (3 a 7 segundos) la
-- misma cotización que el comprador había visto un momento antes. Ahora la cotización que arma el servidor queda
-- guardada media hora, con una clave que sale del carrito, el subtotal y el destino, y al confirmar se reutiliza.
-- El precio del envío sigue sin salir del navegador: la guarda y la lee solo el servidor.

CREATE TABLE IF NOT EXISTS public.envio_cotizaciones (
  clave     text PRIMARY KEY,
  opciones  jsonb NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS envio_cotizaciones_creado_en_idx ON public.envio_cotizaciones (creado_en);

-- Trae lo que le cuesta el envío a Teqo: es solo del servidor. Sin políticas, nadie más la lee ni la escribe.
ALTER TABLE public.envio_cotizaciones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.envio_cotizaciones FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.envio_cotizaciones TO service_role;

COMMENT ON TABLE public.envio_cotizaciones IS
  'Cotizaciones de envío recientes (valen media hora), para no consultar dos veces al correo. La clave es el hash del carrito, el subtotal y el destino. Solo el servidor.';
