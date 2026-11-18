-- 146: plazo para pagar según el medio, y vencimiento cada 15 minutos.
--
-- Había un solo plazo (pendiente_vence_horas, 48 horas) para cualquier medio, y la tarea que vence los pedidos
-- corría una vez por día: un checkout de Mercado Pago abandonado retenía el stock dos o tres días, y con 1 o 2
-- unidades por producto eso lo dejaba "sin stock" a la vista. Mercado Pago se paga en el momento, así que lleva
-- un plazo corto propio; la transferencia conserva el suyo. El vencimiento pasa a correr en la base cada 15 minutos.
--
-- Un pago de Mercado Pago que llega después del vencimiento sigue contemplado: tienda_marcar_pagado vuelve a
-- reservar el stock y, si ya no queda, deja la nota "Pagada sin stock" para revisar.

-- ── El plazo de Mercado Pago ─────────────────────────────────────────────────
INSERT INTO tienda_configuracion (clave, valor, descripcion) VALUES
  ('pendiente_vence_horas_mercadopago', '2'::jsonb,
   'Horas que una compra con Mercado Pago puede quedar pendiente de pago antes de vencer y liberar el stock. Nulo: vale el plazo general (pendiente_vence_horas).')
ON CONFLICT (clave) DO NOTHING;

-- ── Hasta cuándo se puede pagar una compra ───────────────────────────────────
-- Un solo lugar para la cuenta: lo usan el vencimiento, la compra que ve el comprador y el enlace de Mercado Pago.
-- Nulo: ese medio no tiene plazo y la compra no vence.
CREATE OR REPLACE FUNCTION public.tienda_vence_en(p_medio text, p_creado_en timestamptz)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT p_creado_en + make_interval(hours => h.horas)
  FROM (
    SELECT (CASE
      WHEN p_medio IN ('mercadopago', 'mercadopago_cuotas')
        THEN coalesce(tienda_config_numero('pendiente_vence_horas_mercadopago', NULL), tienda_config_numero('pendiente_vence_horas', NULL))
      ELSE tienda_config_numero('pendiente_vence_horas', NULL)
    END)::integer AS horas
  ) h
  WHERE h.horas > 0;
$function$;

REVOKE ALL ON FUNCTION public.tienda_vence_en(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tienda_vence_en(text, timestamptz) TO service_role;

COMMENT ON FUNCTION public.tienda_vence_en(text, timestamptz) IS
  'Hasta cuándo se puede pagar una compra pendiente según su medio de pago. Nulo: no vence.';

-- ── Vencer los pedidos pendientes ────────────────────────────────────────────
-- Ya no recibe las horas: cada pedido vence con el plazo de su medio.
DROP FUNCTION IF EXISTS public.tienda_vencer_pendientes(integer);

CREATE OR REPLACE FUNCTION public.tienda_vencer_pendientes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id bigint;
  v_cantidad integer := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM orders
    WHERE status = 'pendiente_pago' AND origen = 'tienda'
      AND tienda_vence_en(payment_method, created_at) < now()
    ORDER BY created_at
    LIMIT 500
  LOOP
    IF tienda_cancelar_pedido(v_id, 'vencido', 'Venció el plazo para pagar.') THEN
      v_cantidad := v_cantidad + 1;
    END IF;
  END LOOP;
  RETURN v_cantidad;
END;
$function$;

REVOKE ALL ON FUNCTION public.tienda_vencer_pendientes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tienda_vencer_pendientes() TO service_role;

COMMENT ON FUNCTION public.tienda_vencer_pendientes() IS
  'Vence los pedidos de la tienda que pasaron el plazo para pagar de su medio y libera el stock. La corre pg_cron cada 15 minutos.';

-- ── La compra que ve el comprador: suma hasta cuándo puede pagar ─────────────
CREATE OR REPLACE FUNCTION public.tienda_pedido(p_id bigint, p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT jsonb_build_object(
    'id', o.id,
    'numero', o.order_number,
    'estado', o.status,
    'creado_en', o.created_at,
    'pagado_en', o.pagado_en,
    'entregado_en', o.entregado_en,
    'vence_en', CASE WHEN o.status = 'pendiente_pago' THEN public.tienda_vence_en(o.payment_method, o.created_at) END,
    'total', o.total,
    'subtotal', o.subtotal,
    'envio_costo', o.shipping_cost,
    'envio_demora_dias_min', o.envio_demora_dias_min,
    'envio_demora_dias_max', o.envio_demora_dias_max,
    'descuento', o.discount_amount,
    'medio_pago', o.payment_method,
    'seguimiento', o.tracking_number,
    'seguimiento_url', o.envio_seguimiento_url,
    'transporte', COALESCE(o.shipping_transport, CASE WHEN o.shipping_provider = 'zipnova' THEN NULL ELSE o.shipping_provider END),
    'envio_opcion', COALESCE(o.envio_detalle->>'opcion', 'domicilio'),
    'sucursal', o.envio_detalle->>'sucursal',
    'factura', o.factura_path IS NOT NULL,
    'comprador', jsonb_build_object('nombre', o.comprador_nombre, 'email', o.comprador_email),
    'direccion', o.direccion_envio,
    'cupon', (
      SELECT jsonb_build_object(
        'codigo', c.code,
        'tipo', c.discount_type,
        'valor', c.discount_value,
        'minimo', c.min_purchase,
        'tope', c.max_discount,
        'vence_en', c.expires_at,
        'activado', c.client_id IS NOT NULL
      )
      FROM public.coupons c
      WHERE c.origen_order_id = o.id
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'producto_id', i.product_id,
        'nombre', i.name,
        'sku', i.sku,
        'cantidad', i.quantity,
        'precio_final', i.precio_final,
        'slug', p.slug,
        'categoria_slug', c.slug,
        'imagen', p.image
      ) ORDER BY i.id)
      FROM public.order_items i
      LEFT JOIN public.products p ON p.id = i.product_id
      LEFT JOIN public.categories c ON c.id = p.category_id
      WHERE i.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM public.orders o
  WHERE o.id = p_id AND o.token_acceso IS NOT NULL AND o.token_acceso = p_token;
$function$;

-- ── La tarea: cada 15 minutos ────────────────────────────────────────────────
-- Ojo con las restauraciones: el volcado de la base no trae las tareas de pg_cron, hay que volver a crearlas.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
DO $cron$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'tienda-vencer-pendientes';
  PERFORM cron.schedule('tienda-vencer-pendientes', '*/15 * * * *', 'SELECT public.tienda_vencer_pendientes()');
END;
$cron$;
