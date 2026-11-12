-- =============================================================================
-- 143 · Envío de cada producto para el feed
-- El feed de productos (api/_tienda/feed.ts) declara el costo de envío solo cuando es fijo: lo que despacha un
-- mayorista directo paga su tarifa plana a todo el país. Lo que despacha Teqo se cotiza por destino y no se
-- declara. Esta función le da al servidor, de una vez, cómo sale cada producto publicado, con la misma regla
-- de proveedor que usa el checkout (tienda_proveedor_de). No expone quién es el proveedor ni el costo.
-- Solo para el servidor. Idempotente.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tienda_envio_de_productos()
 RETURNS TABLE(product_id integer, directo boolean, tarifa numeric, demora_dias_min integer, demora_dias_max integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id,
         coalesce(s.despacho_directo, false),
         s.envio_tarifa_plana,
         s.envio_demora_dias_min,
         s.envio_demora_dias_max
  FROM products p
  LEFT JOIN suppliers s ON s.id = tienda_proveedor_de(p.id)
  WHERE p.active = true AND p.publicado = true
  ORDER BY p.id;
$function$;

REVOKE ALL ON FUNCTION public.tienda_envio_de_productos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tienda_envio_de_productos() TO service_role;

COMMENT ON FUNCTION public.tienda_envio_de_productos() IS
  'Cómo sale cada producto publicado (despacho directo, tarifa plana y demora), para el feed de productos. Solo servidor.';
