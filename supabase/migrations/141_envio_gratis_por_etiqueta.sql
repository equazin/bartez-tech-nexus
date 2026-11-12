-- =============================================================================
-- 141 · Envío gratis por etiqueta
-- Un carrito en el que todos los productos llevan la etiqueta 'envio-gratis' no paga envío. Se suma al envío
-- gratis por monto (envio_gratis_desde). El servidor aplica la misma regla cuando cotiza con Zipnova y cuando
-- confirma la compra (api/_tienda/envios.ts); acá queda en la cotización pública que usan la ficha y el carrito.
-- Con un solo producto sin la etiqueta, el envío se cobra entero.
-- Idempotente.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tienda_cotizar_envio_carrito(p_items jsonb, p_subtotal numeric DEFAULT 0)
 RETURNS TABLE(precio numeric, demora_dias_min integer, demora_dias_max integer, gratis boolean, disponible boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_defecto     numeric := coalesce(tienda_config_numero('peso_por_defecto_kg', 1), 1);
  v_gratis      numeric := tienda_config_numero('envio_gratis_desde', NULL);
  v_peso_propio numeric := 0;
  v_hay_propio  boolean := false;
  v_precio      numeric := NULL;
  v_min         integer := NULL;
  v_max         integer := NULL;
  v_cotizable   boolean := true;
  v_etiqueta    boolean := false;
  r             record;
  t             record;
BEGIN
  FOR r IN
    SELECT coalesce(p.weight_kg, 0) AS peso,
           greatest(1, coalesce((i->>'cantidad')::integer, 1)) AS cantidad,
           coalesce(s.despacho_directo, false) AS directo,
           s.envio_tarifa_plana AS tarifa,
           s.envio_demora_dias_min AS dmin,
           s.envio_demora_dias_max AS dmax
    FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS i
    JOIN products p ON p.id = (i->>'product_id')::integer
    LEFT JOIN suppliers s ON s.id = tienda_proveedor_de(p.id)
  LOOP
    IF r.directo THEN
      IF r.tarifa IS NULL THEN
        v_cotizable := false;
      ELSE
        v_precio := greatest(coalesce(v_precio, 0), r.tarifa);
        v_min := greatest(coalesce(v_min, 0), coalesce(r.dmin, 0));
        v_max := greatest(coalesce(v_max, 0), coalesce(r.dmax, r.dmin, 0));
      END IF;
    ELSE
      v_hay_propio := true;
      v_peso_propio := v_peso_propio + (CASE WHEN r.peso > 0 THEN r.peso ELSE v_defecto END) * r.cantidad;
    END IF;
  END LOOP;

  IF v_hay_propio THEN
    SELECT * INTO t FROM tienda_cotizar_envio(v_peso_propio, 0);
    IF NOT coalesce(t.disponible, false) OR t.precio IS NULL THEN
      v_cotizable := false;
    ELSE
      v_precio := greatest(coalesce(v_precio, 0), t.precio);
      v_min := greatest(coalesce(v_min, 0), coalesce(t.demora_dias_min, 0));
      v_max := greatest(coalesce(v_max, 0), coalesce(t.demora_dias_max, 0));
    END IF;
  END IF;

  -- Todo el carrito con la etiqueta de envío gratis: sin cargo, aunque no haya tarifa para cotizarlo.
  SELECT coalesce(bool_and(p.id IS NOT NULL AND 'envio-gratis' = ANY (coalesce(p.tags, '{}'))), false)
  INTO v_etiqueta
  FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS i
  LEFT JOIN products p ON p.id = (i->>'product_id')::integer;

  IF v_etiqueta THEN
    RETURN QUERY SELECT 0::numeric, v_min, v_max, true, true;
    RETURN;
  END IF;

  IF NOT v_cotizable OR v_precio IS NULL THEN
    RETURN QUERY SELECT NULL::numeric, NULL::integer, NULL::integer, false, false;
    RETURN;
  END IF;
  IF v_gratis IS NOT NULL AND coalesce(p_subtotal, 0) >= v_gratis THEN
    RETURN QUERY SELECT 0::numeric, v_min, v_max, true, true;
    RETURN;
  END IF;
  RETURN QUERY SELECT v_precio, v_min, v_max, false, true;
END;
$function$;
