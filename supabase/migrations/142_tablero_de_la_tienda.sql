-- =============================================================================
-- 142 · Tablero de la tienda
-- El resumen que el panel no puede armar solo desde el navegador: las visitas (marketing_events pasa de las mil
-- filas que devuelve una consulta), el estado del catálogo, el dólar, la última sincronización y los pagos
-- acreditados. Solo para quien entra al panel; la comisión de cada pago, solo para administrador.
-- Las fechas son días de Argentina, las dos incluidas. El período anterior es el de la misma cantidad de días
-- inmediatamente antes de p_desde.
-- Las visitas son sesiones de navegador que cuenta la propia tienda (src/lib/marketingTracker.ts). Se dejan afuera
-- las del equipo: las que pasaron por el panel o navegaron con una cuenta del panel.
-- Idempotente.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.panel_tablero(p_desde date, p_hasta date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rol      text := lower(coalesce(public.get_my_role(), ''));
  v_zona     constant text := 'America/Argentina/Buenos_Aires';
  v_producto constant text := '^/[^/]+/[^/]+-[0-9]{1,9}$';
  v_dias     integer;
  v_desde    timestamptz;
  v_hasta    timestamptz;
  v_antes    timestamptz;
  v_visitas  jsonb;
  v_catalogo jsonb;
  v_dolar    jsonb;
  v_sync     jsonb;
  v_pagos    jsonb;
  v_prueba   jsonb;
  v_arrep    integer;
BEGIN
  IF v_rol NOT IN ('admin', 'vendedor', 'sales') THEN
    RAISE EXCEPTION 'El tablero es solo para el panel.' USING ERRCODE = '42501';
  END IF;
  IF p_desde IS NULL OR p_hasta IS NULL OR p_hasta < p_desde OR p_hasta - p_desde > 366 THEN
    RAISE EXCEPTION 'El período no es válido.' USING ERRCODE = '22023';
  END IF;

  v_dias  := p_hasta - p_desde + 1;
  v_desde := p_desde::timestamp AT TIME ZONE v_zona;
  v_hasta := (p_hasta + 1)::timestamp AT TIME ZONE v_zona;
  v_antes := (p_desde - v_dias)::timestamp AT TIME ZONE v_zona;

  -- ── Visitas ───────────────────────────────────────────────────────────────
  WITH eventos AS (
    SELECT e.session_id,
           e.page AS pagina,
           e.created_at,
           e.user_id,
           (e.gclid IS NOT NULL OR e.wbraid IS NOT NULL OR e.gbraid IS NOT NULL) AS de_anuncio,
           left(nullif(trim(e.utm_source), ''), 40) AS utm_source,
           -- El dominio desde el que llegó. La vuelta de Mercado Pago después de pagar no es un origen.
           CASE WHEN lower(e.metadata->>'referente') ~ '(mercadopago|mercadolibre)\.' THEN NULL
                ELSE left(nullif(lower(trim(e.metadata->>'referente')), ''), 60) END AS referente
    FROM marketing_events e
    WHERE e.event_type = 'page_view'
      AND e.created_at >= v_antes AND e.created_at < v_hasta
      AND e.session_id IS NOT NULL
      AND e.page IS NOT NULL
  ),
  del_equipo AS (
    SELECT DISTINCT e.session_id
    FROM eventos e
    WHERE e.pagina LIKE '/admin%'
       OR e.pagina LIKE '/clientes/%'
       OR e.user_id IN (SELECT p.id FROM profiles p WHERE lower(p.role) IN ('admin', 'vendedor', 'sales'))
  ),
  vistas AS (
    SELECT e.session_id, e.pagina, e.created_at, e.de_anuncio, e.utm_source, e.referente,
           (e.created_at AT TIME ZONE v_zona)::date AS dia,
           (e.created_at >= v_desde) AS actual
    FROM eventos e
    WHERE e.session_id NOT IN (SELECT d.session_id FROM del_equipo d)
      AND e.pagina NOT LIKE '/login%'
      AND e.pagina NOT LIKE '/reset-password%'
  ),
  por_dia AS (
    SELECT v.dia, count(DISTINCT v.session_id) AS sesiones, count(*) AS vistas
    FROM vistas v
    WHERE v.actual
    GROUP BY v.dia
  ),
  totales AS (
    SELECT count(DISTINCT v.session_id) FILTER (WHERE v.actual) AS sesiones,
           count(*) FILTER (WHERE v.actual) AS vistas,
           count(DISTINCT v.session_id) FILTER (WHERE v.actual AND v.pagina ~ v_producto) AS producto,
           count(DISTINCT v.session_id) FILTER (WHERE v.actual AND v.pagina = '/carrito') AS carrito,
           count(DISTINCT v.session_id) FILTER (WHERE v.actual AND v.pagina = '/checkout') AS checkout,
           count(DISTINCT v.session_id) FILTER (WHERE NOT v.actual) AS sesiones_antes,
           count(*) FILTER (WHERE NOT v.actual) AS vistas_antes
    FROM vistas v
  ),
  mas_vistos AS (
    SELECT (regexp_match(v.pagina, '-([0-9]{1,9})$'))[1]::integer AS product_id,
           count(DISTINCT v.session_id) AS sesiones,
           count(*) AS vistas
    FROM vistas v
    WHERE v.actual AND v.pagina ~ v_producto
    GROUP BY 1
  ),
  por_sesion AS (
    SELECT v.session_id,
           bool_or(v.de_anuncio) AS de_anuncio,
           max(v.utm_source) AS utm_source,
           (array_agg(v.referente ORDER BY v.created_at) FILTER (WHERE v.referente IS NOT NULL))[1] AS referente
    FROM vistas v
    WHERE v.actual
    GROUP BY v.session_id
  ),
  origenes AS (
    SELECT CASE
             WHEN s.de_anuncio THEN 'Anuncios de Google'
             WHEN s.utm_source IS NOT NULL THEN 'Campaña: ' || s.utm_source
             WHEN s.referente ~ '(google|bing|duckduckgo|yahoo|ecosia|brave)\.' THEN 'Buscadores'
             WHEN s.referente ~ '(instagram|facebook|tiktok|youtube|twitter|whatsapp|linkedin|pinterest)\.|^(t\.co|x\.com|wa\.me|lnkd\.in)$' THEN 'Redes sociales'
             WHEN s.referente IS NOT NULL THEN s.referente
             ELSE 'Directo o sin dato'
           END AS origen,
           count(*) AS sesiones
    FROM por_sesion s
    GROUP BY 1
  )
  SELECT jsonb_build_object(
    'sesiones', t.sesiones,
    'vistas', t.vistas,
    'producto', t.producto,
    'carrito', t.carrito,
    'checkout', t.checkout,
    'sesiones_antes', t.sesiones_antes,
    'vistas_antes', t.vistas_antes,
    'por_dia', coalesce((
      SELECT jsonb_agg(jsonb_build_object('dia', d.dia, 'sesiones', d.sesiones, 'vistas', d.vistas) ORDER BY d.dia)
      FROM por_dia d), '[]'::jsonb),
    'productos', coalesce((
      SELECT jsonb_agg(x.fila ORDER BY x.sesiones DESC, x.vistas DESC, x.id)
      FROM (
        SELECT p.id, m.sesiones, m.vistas,
               jsonb_build_object(
                 'id', p.id,
                 'nombre', coalesce(p.name_custom, p.name_original, p.name),
                 'sesiones', m.sesiones,
                 'vistas', m.vistas,
                 'hay_stock', greatest(coalesce(p.stock, 0) - coalesce(p.stock_reserved, 0), 0) > 0,
                 'publicado', (p.active = true AND p.publicado = true)
               ) AS fila
        FROM mas_vistos m
        JOIN products p ON p.id = m.product_id
        WHERE NOT ('prueba' = ANY (coalesce(p.tags, '{}')))
        ORDER BY m.sesiones DESC, m.vistas DESC, p.id
        LIMIT 8
      ) x), '[]'::jsonb),
    'origenes', coalesce((
      SELECT jsonb_agg(jsonb_build_object('origen', o.origen, 'sesiones', o.sesiones) ORDER BY o.sesiones DESC, o.origen)
      FROM (SELECT g.origen, g.sesiones FROM origenes g ORDER BY g.sesiones DESC, g.origen LIMIT 6) o), '[]'::jsonb)
  )
  INTO v_visitas
  FROM totales t;

  -- ── Catálogo ──────────────────────────────────────────────────────────────
  SELECT jsonb_build_object(
    'publicados', count(*) FILTER (WHERE x.publicado),
    'sin_stock', count(*) FILTER (WHERE x.publicado AND x.disponible <= 0),
    'pocas_unidades', count(*) FILTER (WHERE x.publicado AND x.disponible BETWEEN 1 AND 3),
    'sin_foto', count(*) FILTER (WHERE x.publicado AND NOT x.con_foto),
    'sin_descripcion', count(*) FILTER (WHERE x.publicado AND NOT x.con_descripcion),
    'sin_precio', count(*) FILTER (WHERE x.publicado AND NOT x.con_precio),
    'precio_manual', count(*) FILTER (WHERE x.publicado AND x.precio_manual),
    'en_oferta', count(*) FILTER (WHERE x.publicado AND x.en_oferta),
    'de_prueba', count(*) FILTER (WHERE x.publicado AND x.de_prueba),
    'sin_publicar', count(*) FILTER (WHERE NOT x.publicado)
  )
  INTO v_catalogo
  FROM (
    SELECT (p.active = true AND p.publicado = true) AS publicado,
           greatest(coalesce(p.stock, 0) - coalesce(p.stock_reserved, 0), 0) AS disponible,
           (CASE WHEN jsonb_typeof(p.images) = 'array' THEN jsonb_array_length(p.images) > 0 ELSE false END
             OR coalesce(p.image, '') <> '') AS con_foto,
           (trim(coalesce(p.description_full, p.description, '')) <> '') AS con_descripcion,
           (coalesce(p.precio_final_ars, 0) > 0) AS con_precio,
           coalesce(p.precio_manual, false) AS precio_manual,
           (p.precio_lista_ars IS NOT NULL AND p.precio_final_ars IS NOT NULL AND p.precio_lista_ars > p.precio_final_ars) AS en_oferta,
           ('prueba' = ANY (coalesce(p.tags, '{}'))) AS de_prueba
    FROM products p
  ) x;

  SELECT coalesce(jsonb_agg(p.id ORDER BY p.id), '[]'::jsonb)
  INTO v_prueba
  FROM products p
  WHERE 'prueba' = ANY (coalesce(p.tags, '{}'));

  -- ── Dólar y sincronización ────────────────────────────────────────────────
  SELECT jsonb_build_object('valor', c.valor, 'desde', c.vigente_desde, 'fuente', c.fuente, 'nota', c.nota)
  INTO v_dolar
  FROM cotizacion_dolar c
  ORDER BY c.vigente_desde DESC, c.id DESC
  LIMIT 1;

  SELECT jsonb_build_object('detalle', t.valor, 'actualizado_en', t.actualizado_en)
  INTO v_sync
  FROM tienda_configuracion t
  WHERE t.clave = 'sincronizacion_ultima';

  -- ── Pagos acreditados (para la comisión de cada venta) ────────────────────
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'order_id', g.order_id,
           'proveedor', g.proveedor,
           'estado', g.estado,
           'cuotas', g.cuotas,
           'comision', CASE WHEN v_rol = 'admin' AND jsonb_typeof(g.detalle->'comision') = 'number'
                            THEN (g.detalle->>'comision')::numeric END,
           'reintegrado', coalesce(g.reintegrado_monto, 0)
         ) ORDER BY g.id), '[]'::jsonb)
  INTO v_pagos
  FROM pagos g
  WHERE g.estado IN ('aprobado', 'reintegrado')
    AND coalesce(g.aprobado_en, g.creado_en) >= v_antes;

  SELECT count(*) INTO v_arrep FROM arrepentimientos a WHERE a.estado IN ('recibido', 'en_proceso');

  RETURN jsonb_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'dias', v_dias,
    'visitas', v_visitas,
    'catalogo', v_catalogo,
    'productos_de_prueba', v_prueba,
    'dolar', v_dolar,
    'sincronizacion', v_sync,
    'pagos', v_pagos,
    'arrepentimientos_abiertos', v_arrep,
    'pendiente_vence_horas', public.tienda_config_numero('pendiente_vence_horas', NULL),
    'generado_en', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.panel_tablero(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.panel_tablero(date, date) TO authenticated;

COMMENT ON FUNCTION public.panel_tablero(date, date) IS
  'Resumen del tablero del panel: visitas, catálogo, dólar, sincronización y pagos acreditados del período. Solo para el panel.';
