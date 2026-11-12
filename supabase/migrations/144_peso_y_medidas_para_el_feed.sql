-- =============================================================================
-- 144 · Peso y medidas de cada producto para el feed
-- La política de envío de Merchant Center cobra por peso lo que Teqo cotiza por destino. El correo cobra por el
-- peso o por el volumen de la caja, el que sea mayor, así que el feed necesita las dos cosas: el peso (con el
-- valor por defecto si falta) y las medidas de la caja de la categoría, igual que las usa la cotización
-- (tienda_envio_partes). Se suman a la función de la migración 143; como cambia lo que devuelve, se recrea.
-- Solo para el servidor. Idempotente.
-- =============================================================================

DROP FUNCTION IF EXISTS public.tienda_envio_de_productos();

CREATE FUNCTION public.tienda_envio_de_productos()
 RETURNS TABLE(
   product_id integer,
   directo boolean,
   tarifa numeric,
   demora_dias_min integer,
   demora_dias_max integer,
   peso_kg numeric,
   alto_cm integer,
   ancho_cm integer,
   largo_cm integer
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH defecto AS (
    SELECT coalesce((valor->>'alto')::integer, 15) AS alto,
           coalesce((valor->>'ancho')::integer, 25) AS ancho,
           coalesce((valor->>'largo')::integer, 30) AS largo
    FROM tienda_configuracion WHERE clave = 'envio_medidas_defecto'
    UNION ALL SELECT 15, 25, 30
    LIMIT 1
  )
  SELECT p.id,
         coalesce(s.despacho_directo, false),
         s.envio_tarifa_plana,
         s.envio_demora_dias_min,
         s.envio_demora_dias_max,
         CASE WHEN coalesce(p.weight_kg, 0) > 0 THEN p.weight_kg ELSE coalesce(tienda_config_numero('peso_por_defecto_kg', 1), 1) END,
         coalesce(mc.alto_cm, mp.alto_cm, d.alto),
         coalesce(mc.ancho_cm, mp.ancho_cm, d.ancho),
         coalesce(mc.largo_cm, mp.largo_cm, d.largo)
  FROM products p
  LEFT JOIN suppliers s ON s.id = tienda_proveedor_de(p.id)
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN envio_medidas mc ON mc.categoria_id = c.id
  LEFT JOIN envio_medidas mp ON mp.categoria_id = c.parent_id
  CROSS JOIN defecto d
  WHERE p.active = true AND p.publicado = true
  ORDER BY p.id;
$function$;

REVOKE ALL ON FUNCTION public.tienda_envio_de_productos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tienda_envio_de_productos() TO service_role;

COMMENT ON FUNCTION public.tienda_envio_de_productos() IS
  'Cómo sale cada producto publicado (despacho directo, tarifa plana, demora, peso y medidas de la caja), para el feed de productos. Solo servidor.';
