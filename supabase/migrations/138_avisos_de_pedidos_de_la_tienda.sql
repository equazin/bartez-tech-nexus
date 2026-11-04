-- Teqo · Avisos en el panel por los pedidos de la tienda
--
-- La campanita del panel solo avisaba los pedidos mayoristas (estado 'pending'). Los de la tienda nacen en
-- 'pendiente_pago' y no avisaban nada. Desde ahora, a cada admin le llega:
--   1. "Nuevo pedido de la tienda" cuando se crea un pedido de la tienda.
--   2. "Pago acreditado" cuando un pedido de la tienda pasa a pagado (Mercado Pago o transferencia confirmada).
-- Además, solo el servidor y estos disparadores crean avisos: un usuario con sesión ya no puede insertarlos.

CREATE OR REPLACE FUNCTION tienda_pesos_para_aviso(p_monto numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '$ ' || replace(to_char(round(coalesce(p_monto, 0)), 'FM999,999,999,990'), ',', '.');
$$;

CREATE OR REPLACE FUNCTION public.fn_notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  admin_rec RECORD;
  client_name TEXT;
  v_numero TEXT := COALESCE(NEW.order_number, '#' || LEFT(NEW.id::TEXT, 8));
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.origen = 'tienda' THEN
    FOR admin_rec IN SELECT id FROM profiles WHERE role = 'admin' LOOP
      INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, metadata)
      VALUES (
        admin_rec.id,
        'new_order',
        'Nuevo pedido de la tienda',
        v_numero || ' · ' || COALESCE(NEW.comprador_nombre, NEW.comprador_email, 'Comprador') || ' · ' || tienda_pesos_para_aviso(NEW.total)
          || CASE WHEN NEW.payment_method = 'transferencia' THEN ' · espera la transferencia' ELSE ' · pendiente de pago' END,
        'order',
        NEW.id::TEXT,
        jsonb_build_object('order_number', NEW.order_number, 'total', NEW.total, 'origen', 'tienda', 'medio', NEW.payment_method)
      );
    END LOOP;
    RETURN NEW;
  END IF;

  IF NEW.status = 'pending' THEN
    SELECT COALESCE(company_name, contact_name, 'Cliente') INTO client_name
    FROM profiles WHERE id = NEW.client_id::UUID;

    FOR admin_rec IN SELECT id FROM profiles WHERE role = 'admin' LOOP
      INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, metadata)
      VALUES (
        admin_rec.id,
        'new_order',
        'Nuevo pedido recibido',
        v_numero || ' · ' || COALESCE(client_name, ''),
        'order',
        NEW.id::TEXT,
        jsonb_build_object('order_number', NEW.order_number, 'total', NEW.total, 'client_name', client_name)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tienda_avisar_pago_acreditado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  admin_rec RECORD;
BEGIN
  IF NEW.origen = 'tienda' AND NEW.status = 'pagado' AND OLD.status IS DISTINCT FROM 'pagado' THEN
    FOR admin_rec IN SELECT id FROM profiles WHERE role = 'admin' LOOP
      INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id, metadata)
      VALUES (
        admin_rec.id,
        'order_status',
        'Pago acreditado',
        COALESCE(NEW.order_number, '#' || LEFT(NEW.id::TEXT, 8)) || ' · ' || COALESCE(NEW.comprador_nombre, NEW.comprador_email, 'Comprador')
          || ' · ' || tienda_pesos_para_aviso(NEW.total) || ' · listo para preparar',
        'order',
        NEW.id::TEXT,
        jsonb_build_object('order_number', NEW.order_number, 'total', NEW.total, 'origen', 'tienda', 'medio', NEW.payment_method)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tienda_avisar_pago_acreditado ON orders;
CREATE TRIGGER tienda_avisar_pago_acreditado
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION tienda_avisar_pago_acreditado();

-- Los avisos los crean el servidor (service role) y los disparadores: nadie los inserta desde el navegador.
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON notifications;

-- La campanita escucha los avisos nuevos en tiempo real: la tabla tiene que estar en la publicación.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
