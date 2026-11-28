-- 150: Mobbex y Openpay (BBVA) como medios de pago, apagados hasta tener credenciales y comisiones.
--
-- Decisión de Nico del 27/11/2026: sus avisos de pago no vienen firmados, así que un pago de estos medios se
-- confirma consultando la operación a la API del proveedor con las credenciales de la tienda (el aviso solo
-- dispara la consulta y trae un código propio en la dirección). Nada se marca pagado por lo que diga el aviso.
--
-- Los dos medios entran apagados y con el margen de Mercado Pago en 1 pago: así, si alguien los prende antes de
-- cargar la comisión real, nunca quedan más baratos que Mercado Pago. Se prenden en Configuración › Transferencia
-- y medios, después de cargar las credenciales en Vercel y el margen que corresponda a su comisión.
-- Idempotente.

-- ── Los medios ───────────────────────────────────────────────────────────────
ALTER TABLE medios_de_pago DROP CONSTRAINT IF EXISTS medios_de_pago_id_check;
ALTER TABLE medios_de_pago ADD CONSTRAINT medios_de_pago_id_check
  CHECK (id IN ('mercadopago', 'mercadopago_cuotas', 'transferencia', 'mobbex', 'openpay'));

INSERT INTO medios_de_pago (id, nombre, detalle, activo, orden, margen_porcentaje)
SELECT 'mobbex', 'Mobbex', 'Tarjeta de débito o crédito. Pagás en Mobbex y volvés a la tienda.', false, 4,
       coalesce((SELECT margen_porcentaje FROM medios_de_pago WHERE id = 'mercadopago'), 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO medios_de_pago (id, nombre, detalle, activo, orden, margen_porcentaje)
SELECT 'openpay', 'Openpay', 'Tarjeta de débito o crédito, con Openpay de BBVA. Pagás en Openpay y volvés a la tienda.', false, 5,
       coalesce((SELECT margen_porcentaje FROM medios_de_pago WHERE id = 'mercadopago'), 0)
ON CONFLICT (id) DO NOTHING;

-- ── Los pagos ────────────────────────────────────────────────────────────────
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_proveedor_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_proveedor_check
  CHECK (proveedor IN ('mercadopago', 'transferencia', 'mobbex', 'openpay'));

-- ── Plazo para pagar: los cobros en línea usan el plazo corto de Mercado Pago ─
CREATE OR REPLACE FUNCTION public.tienda_vence_en(p_medio text, p_creado_en timestamptz)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT p_creado_en + make_interval(hours => h.horas)
  FROM (
    SELECT (CASE
      WHEN p_medio IN ('mercadopago', 'mercadopago_cuotas', 'mobbex', 'openpay')
        THEN coalesce(tienda_config_numero('pendiente_vence_horas_mercadopago', NULL), tienda_config_numero('pendiente_vence_horas', NULL))
      ELSE tienda_config_numero('pendiente_vence_horas', NULL)
    END)::integer AS horas
  ) h
  WHERE h.horas > 0;
$function$;

REVOKE ALL ON FUNCTION public.tienda_vence_en(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tienda_vence_en(text, timestamptz) TO service_role;

COMMENT ON FUNCTION public.tienda_vence_en(text, timestamptz) IS
  'Hasta cuándo se puede pagar una compra pendiente según su medio de pago. Nulo: no vence. Los cobros en línea (Mercado Pago, Mobbex, Openpay) usan el plazo corto.';

-- ── Servicios: sin precio propio, un cobro con tarjeta vale lo mismo que Mercado Pago en 1 pago ─
CREATE OR REPLACE FUNCTION servicio_precio_con_medio(p_precios jsonb, p_medio text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    CASE WHEN jsonb_typeof(p_precios->p_medio) = 'number' AND (p_precios->>p_medio)::numeric > 0
         THEN (p_precios->>p_medio)::numeric END,
    CASE WHEN p_medio IN ('mercadopago_cuotas', 'mobbex', 'openpay') AND jsonb_typeof(p_precios->'mercadopago') = 'number' AND (p_precios->>'mercadopago')::numeric > 0
         THEN (p_precios->>'mercadopago')::numeric END
  );
$$;
