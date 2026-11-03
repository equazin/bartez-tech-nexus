-- El seguimiento de visitas (src/lib/marketingTracker.ts) manda gclid, wbraid y gbraid como
-- columnas; en Bartez existían cargadas a mano y en un proyecto nuevo faltaban, así que cada
-- visita daba 400. Idempotente.
ALTER TABLE marketing_events
  ADD COLUMN IF NOT EXISTS gclid  text,
  ADD COLUMN IF NOT EXISTS wbraid text,
  ADD COLUMN IF NOT EXISTS gbraid text;
