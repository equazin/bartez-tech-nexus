-- 145: cerrar al público las vistas y las funciones heredadas del portal mayorista.
--
-- La tienda se armó con las migraciones de Bartez, pensadas para clientes aprobados. En una tienda abierta
-- cualquier visitante usa la clave pública (rol anon) y cualquier comprador con cuenta es authenticated.
-- El 17/11/2026 se comprobó, consultando como anon, que las vistas heredadas mostraban el costo de los
-- productos, las reglas de margen, las líneas de los pedidos y el registro de actividad, y que había
-- funciones que creaban pedidos con cualquier estado sin revisar quién las llamaba.
--
-- 1. Vistas heredadas: pasan a respetar los permisos de quien consulta (security_invoker) y anon pierde el
--    acceso. El panel las sigue viendo, porque las tablas de abajo tienen políticas para admin y vendedor.
--    Las de la vidriera quedan como están: muestran a propósito solo columnas públicas.
-- 2. Funciones con permisos elevados (SECURITY DEFINER): anon conserva solo las que usa la vidriera.
-- 3. Las que crean pedidos, mueven stock, borran registros o leen datos de otros sin revisar el rol tampoco
--    quedan para usuarios con sesión. El servidor (service_role) las sigue pudiendo usar.
-- 4. De ahora en más, una función nueva no queda abierta al público si su migración no lo dice.
--
-- Regla para lo que venga: toda vista nueva lleva security_invoker o su REVOKE, y toda función nueva lleva
-- su REVOKE y su GRANT explícitos.

-- 1. Vistas ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  v record;
  de_la_vidriera text[] := ARRAY[
    'tienda_productos', 'tienda_portadas', 'tienda_secciones_inicio', 'tienda_servicios', 'tienda_pc_armadas'
  ];
BEGIN
  FOR v IN
    SELECT c.relname::text AS nombre, c.relkind AS tipo
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind IN ('v', 'm')
      AND c.relname::text <> ALL (de_la_vidriera)
  LOOP
    IF v.tipo = 'v' THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v.nombre);
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', v.nombre);
    ELSE
      -- Una vista materializada no puede respetar los permisos de quien consulta: se cierra entera.
      EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', v.nombre);
    END IF;
  END LOOP;
END $$;

-- 2 y 3. Funciones --------------------------------------------------------------------------------------
DO $$
DECLARE
  f record;
  -- Lo que la vidriera llama sin sesión, y get_my_role, que usan las políticas de las tablas.
  para_el_publico text[] := ARRAY[
    'tienda_buscar', 'tienda_categorias', 'tienda_contenido_legal', 'tienda_cotizar_envio',
    'tienda_cotizar_envio_carrito', 'tienda_pedido', 'tienda_pedido_por_email', 'tienda_programa_de_puntos',
    'get_my_role'
  ];
  -- Crean pedidos o facturas, mueven stock, borran registros o leen datos de otros sin revisar quién llama.
  solo_para_el_servidor text[] := ARRAY[
    'reserve_stock_and_create_order', 'reserve_stock_create_order_v2', 'reserve_stock_create_order_v3',
    'reserve_stock_create_order_v4', 'reserve_stock_create_order_v5', 'convert_quote_to_order',
    'create_invoice_from_order', 'fulfill_stock_for_order', 'unreserve_stock_for_order',
    'receive_purchase_order', 'archive_old_activity_logs', 'enqueue_webhook_event', 'expire_overdue_quotes',
    'analyze_compatibility_v1', 'refresh_mv_client_kpis', 'refresh_mv_price_list_per_client',
    'get_order_items', 'get_portal_price', 'get_price_list_for_client', 'get_active_price_agreement',
    'get_category_counts', 'get_hidden_product_ids_for_client', 'get_catalog_statistics', 'is_client_in_mora'
  ];
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS firma,
           p.proname::text AS nombre,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS con_sesion
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prokind = 'f'
      AND p.prosecdef
      -- Las de disparador no se pueden llamar desde afuera.
      AND p.prorettype <> 'trigger'::regtype
  LOOP
    IF f.nombre = ANY (solo_para_el_servidor) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.firma);
    ELSIF f.nombre <> ALL (para_el_publico) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.firma);
      -- Quien ya la podía usar con sesión la conserva, aunque el permiso le viniera del público.
      IF f.con_sesion THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.firma);
      END IF;
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.firma);
  END LOOP;
END $$;

-- 4. Lo nuevo no nace abierto ---------------------------------------------------------------------------
-- Postgres le da EXECUTE a todos sobre cada función nueva, y Supabase se lo da además a anon en public.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- Comprobación: si algo de lo grave quedó abierto, la migración no se aplica.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND (p.proname LIKE 'reserve_stock%' OR p.proname IN ('convert_quote_to_order', 'create_invoice_from_order'))
      AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  ) THEN
    RAISE EXCEPTION 'Quedó abierta una función que crea pedidos o facturas.';
  END IF;
  IF has_table_privilege('anon', 'public.products_without_movement', 'SELECT')
     OR has_table_privilege('anon', 'public.product_stock_summary', 'SELECT')
     OR has_table_privilege('anon', 'public.active_pricing_rules', 'SELECT') THEN
    RAISE EXCEPTION 'Quedó abierta al público una vista con costos o márgenes.';
  END IF;
  IF NOT has_table_privilege('anon', 'public.tienda_productos', 'SELECT')
     OR NOT has_function_privilege('anon', 'public.tienda_buscar(text, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Se cerró algo que la vidriera necesita.';
  END IF;
END $$;
