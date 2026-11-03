-- 073_client_360_last_contact.sql
-- Cliente 360: persistencia explicita del ultimo contacto comercial

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contact_type text
    CHECK (last_contact_type IN ('nota', 'llamada', 'reunion', 'seguimiento', 'alerta', 'pedido', 'cotizacion', 'ticket'));

CREATE INDEX IF NOT EXISTS idx_profiles_last_contact_at ON public.profiles(last_contact_at DESC);

WITH latest_note AS (
  SELECT DISTINCT ON (client_id)
    client_id,
    created_at,
    tipo
  FROM public.client_notes
  ORDER BY client_id, created_at DESC
),
latest_ticket AS (
  SELECT DISTINCT ON (client_id)
    client_id,
    updated_at
  FROM public.support_tickets
  ORDER BY client_id, updated_at DESC
),
latest_quote AS (
  SELECT DISTINCT ON (client_id)
    client_id,
    COALESCE(updated_at, created_at) AS touched_at
  FROM public.quotes
  ORDER BY client_id, COALESCE(updated_at, created_at) DESC
),
latest_order AS (
  SELECT DISTINCT ON (client_id)
    client_id,
    created_at
  FROM public.orders
  ORDER BY client_id, created_at DESC
)
UPDATE public.profiles AS p
SET
  last_contact_at = COALESCE(
    p.last_contact_at,
    ln.created_at,
    lt.updated_at,
    lq.touched_at,
    lo.created_at
  ),
  last_contact_type = COALESCE(
    p.last_contact_type,
    ln.tipo,
    CASE WHEN lt.updated_at IS NOT NULL THEN 'ticket' END,
    CASE WHEN lq.touched_at IS NOT NULL THEN 'cotizacion' END,
    CASE WHEN lo.created_at IS NOT NULL THEN 'pedido' END
  )
FROM latest_note ln
FULL OUTER JOIN latest_ticket lt ON lt.client_id = ln.client_id
FULL OUTER JOIN latest_quote lq ON lq.client_id = COALESCE(ln.client_id, lt.client_id)
FULL OUTER JOIN latest_order lo ON lo.client_id = COALESCE(ln.client_id, lt.client_id, lq.client_id)
WHERE p.id = COALESCE(ln.client_id, lt.client_id, lq.client_id, lo.client_id)
  AND (p.last_contact_at IS NULL OR p.last_contact_type IS NULL);

CREATE OR REPLACE FUNCTION public.touch_profile_last_contact()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_contact_type text;
  v_contact_at timestamptz;
BEGIN
  IF TG_TABLE_NAME = 'client_notes' THEN
    v_contact_type := NEW.tipo;
    v_contact_at := NEW.created_at;
  ELSIF TG_TABLE_NAME = 'support_tickets' THEN
    v_contact_type := 'ticket';
    v_contact_at := COALESCE(NEW.updated_at, NEW.created_at, now());
  ELSIF TG_TABLE_NAME = 'quotes' THEN
    v_contact_type := 'cotizacion';
    v_contact_at := COALESCE(NEW.updated_at, NEW.created_at, now());
  ELSIF TG_TABLE_NAME = 'orders' THEN
    v_contact_type := 'pedido';
    v_contact_at := COALESCE(NEW.created_at, now());
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET
    last_contact_at = v_contact_at,
    last_contact_type = v_contact_type
  WHERE id = NEW.client_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_notes_touch_last_contact ON public.client_notes;
CREATE TRIGGER trg_client_notes_touch_last_contact
AFTER INSERT ON public.client_notes
FOR EACH ROW
WHEN (NEW.tipo IN ('llamada', 'reunion', 'seguimiento', 'nota', 'alerta'))
EXECUTE FUNCTION public.touch_profile_last_contact();

DROP TRIGGER IF EXISTS trg_support_tickets_touch_last_contact ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_touch_last_contact
AFTER INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.touch_profile_last_contact();

DROP TRIGGER IF EXISTS trg_quotes_touch_last_contact ON public.quotes;
CREATE TRIGGER trg_quotes_touch_last_contact
AFTER INSERT OR UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.touch_profile_last_contact();

DROP TRIGGER IF EXISTS trg_orders_touch_last_contact ON public.orders;
CREATE TRIGGER trg_orders_touch_last_contact
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.touch_profile_last_contact();
