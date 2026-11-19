-- =============================================================================
-- 149 · El envío sin cargo se informa aunque no haya tarifa para cotizarlo
-- La cotización pública (la que usan la ficha y el carrito, antes de que el comprador cargue su dirección) devolvía
-- "no disponible" para todo lo que despacha Teqo: con Zipnova activo no hay tabla por peso, el costo depende del
-- destino. Eso tapaba el envío gratis por monto (envio_gratis_desde): la función salía por "no cotizable" antes de
-- mirarlo, y la ficha de un producto que supera ese monto decía "A confirmar" cuando el checkout no cobra envío.
-- Ahora el envío gratis (por monto o por la etiqueta 'envio-gratis') se resuelve primero: el costo ya se sabe, es
-- cero. El plazo se informa solo si se pudo cotizar todo el carrito; si no, depende del destino y queda nulo.
-- Lo demás no cambia. Idempotente.
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

  -- Todo el carrito con la etiqueta de envío gratis.
  SELECT coalesce(bool_and(p.id IS NOT NULL AND 'envio-gratis' = ANY (coalesce(p.tags, '{}'))), false)
  INTO v_etiqueta
  FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) AS i
  LEFT JOIN products p ON p.id = (i->>'product_id')::integer;

  -- Sin cargo, por la etiqueta o por el monto de la compra: vale aunque no haya tarifa para cotizar el carrito sin
  -- destino. El plazo va solo si se pudo cotizar todo; con una parte sin cotizar, depende del destino.
  IF v_etiqueta OR (v_gratis IS NOT NULL AND coalesce(p_subtotal, 0) >= v_gratis) THEN
    RETURN QUERY SELECT 0::numeric,
                        CASE WHEN v_cotizable THEN v_min END,
                        CASE WHEN v_cotizable THEN v_max END,
                        true, true;
    RETURN;
  END IF;

  IF NOT v_cotizable OR v_precio IS NULL THEN
    RETURN QUERY SELECT NULL::numeric, NULL::integer, NULL::integer, false, false;
    RETURN;
  END IF;
  RETURN QUERY SELECT v_precio, v_min, v_max, false, true;
END;
$function$;

-- La cotización es pública (la piden la ficha y el carrito sin sesión): los permisos de la migración 133 siguen
-- valiendo con CREATE OR REPLACE; se repiten para que este archivo alcance solo.
GRANT EXECUTE ON FUNCTION public.tienda_cotizar_envio_carrito(jsonb, numeric) TO anon, authenticated;
