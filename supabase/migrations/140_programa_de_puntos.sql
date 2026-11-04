-- =============================================================================
-- 140 · Puntos Teqo
-- Se suman al entregar una compra de la tienda (sobre lo pagado en productos, sin el envío y después de
-- descuentos), quedan pendientes durante el plazo de arrepentimiento, vencen a los meses que diga el panel y se
-- canjean por un cupón personal de monto fijo, ya activado, que usa el checkout de siempre.
-- Todo se calcula acá: el navegador solo muestra. Los movimientos no se editan; el saldo es su suma.
-- =============================================================================

-- ── Reglas (panel › Marketing › Puntos) ──────────────────────────────────────
INSERT INTO public.tienda_configuracion (clave, valor, descripcion) VALUES (
  'programa_de_puntos',
  '{"activo": true, "pesos_por_punto": 1000, "valor_del_punto": 10, "dias_de_espera": 10, "meses_de_vencimiento": 12,
    "minimo_para_canjear": 100, "tope_porcentaje": 30, "dias_del_cupon": 60,
    "bono_cuenta": 0, "bono_datos": 0, "bono_primera_compra": 0}'::jsonb,
  'Puntos Teqo: cuántos pesos hacen un punto, cuánto vale al canjear, espera, vencimiento, canje y bonos.'
) ON CONFLICT (clave) DO NOTHING;

-- ── Movimientos ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.puntos_movimientos (
  id               bigserial PRIMARY KEY,
  email            text NOT NULL CHECK (email = lower(email) AND length(email) <= 320),
  -- compra y bono suman; canje resta y devolucion lo devuelve; reverso anula una compra; vencimiento resta.
  tipo             text NOT NULL CHECK (tipo IN ('compra', 'bono', 'canje', 'devolucion', 'reverso', 'vencimiento', 'ajuste')),
  puntos           integer NOT NULL CHECK (puntos <> 0),
  order_id         bigint,
  cupon_id         uuid,
  evento           text,
  disponible_desde timestamptz NOT NULL DEFAULT now(),
  vence_en         timestamptz,
  detalle          text CHECK (detalle IS NULL OR length(detalle) <= 300),
  creado_por       uuid,
  creado_en        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_puntos_movimientos_email ON public.puntos_movimientos (email, creado_en DESC);
-- Nada se acredita dos veces: una compra y un reverso por pedido, un bono de cada tipo por email, un canje y una
-- devolución por cupón.
CREATE UNIQUE INDEX IF NOT EXISTS puntos_una_compra_por_pedido ON public.puntos_movimientos (order_id, tipo) WHERE tipo IN ('compra', 'reverso');
CREATE UNIQUE INDEX IF NOT EXISTS puntos_un_bono_por_email ON public.puntos_movimientos (email, evento) WHERE tipo = 'bono';
CREATE UNIQUE INDEX IF NOT EXISTS puntos_un_canje_por_cupon ON public.puntos_movimientos (cupon_id, tipo) WHERE tipo IN ('canje', 'devolucion');

ALTER TABLE public.puntos_movimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS puntos_movimientos_panel ON public.puntos_movimientos;
CREATE POLICY puntos_movimientos_panel ON public.puntos_movimientos FOR SELECT TO authenticated
  USING (lower(COALESCE(public.get_my_role(), '')) = ANY (ARRAY['admin', 'vendedor']));

-- Los movimientos no se cambian: un error se corrige con otro movimiento (ajuste o reverso).
CREATE OR REPLACE FUNCTION public.puntos_sin_editar()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  RAISE EXCEPTION 'Los movimientos de puntos no se editan: cargá un ajuste.';
END;
$function$;
DROP TRIGGER IF EXISTS puntos_sin_editar ON public.puntos_movimientos;
CREATE TRIGGER puntos_sin_editar BEFORE UPDATE ON public.puntos_movimientos FOR EACH ROW EXECUTE FUNCTION public.puntos_sin_editar();

-- ── Eventos: puntos multiplicados por fechas, y si se quiere, solo en algunas categorías ──
CREATE TABLE IF NOT EXISTS public.puntos_eventos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 80),
  multiplicador  numeric(4,2) NOT NULL CHECK (multiplicador >= 1 AND multiplicador <= 10),
  desde          timestamptz NOT NULL,
  hasta          timestamptz NOT NULL,
  categorias     bigint[],
  activo         boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT puntos_eventos_fechas CHECK (hasta > desde)
);

ALTER TABLE public.puntos_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS puntos_eventos_admin ON public.puntos_eventos;
CREATE POLICY puntos_eventos_admin ON public.puntos_eventos FOR ALL TO authenticated
  USING (lower(COALESCE(public.get_my_role(), '')) = 'admin')
  WITH CHECK (lower(COALESCE(public.get_my_role(), '')) = 'admin');

-- ── Reglas leídas con valores seguros ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.puntos_config()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
  SELECT jsonb_build_object(
    'activo',               COALESCE((v->>'activo')::boolean, false),
    'pesos_por_punto',      GREATEST(COALESCE(NULLIF(v->>'pesos_por_punto', '')::numeric, 1000), 1),
    'valor_del_punto',      GREATEST(COALESCE(NULLIF(v->>'valor_del_punto', '')::numeric, 0), 0),
    'dias_de_espera',       LEAST(GREATEST(COALESCE(NULLIF(v->>'dias_de_espera', '')::int, 10), 0), 90),
    'meses_de_vencimiento', LEAST(GREATEST(COALESCE(NULLIF(v->>'meses_de_vencimiento', '')::int, 12), 1), 60),
    'minimo_para_canjear',  GREATEST(COALESCE(NULLIF(v->>'minimo_para_canjear', '')::int, 1), 1),
    'tope_porcentaje',      LEAST(GREATEST(COALESCE(NULLIF(v->>'tope_porcentaje', '')::numeric, 30), 1), 100),
    'dias_del_cupon',       LEAST(GREATEST(COALESCE(NULLIF(v->>'dias_del_cupon', '')::int, 60), 1), 365),
    'bono_cuenta',          GREATEST(COALESCE(NULLIF(v->>'bono_cuenta', '')::int, 0), 0),
    'bono_datos',           GREATEST(COALESCE(NULLIF(v->>'bono_datos', '')::int, 0), 0),
    'bono_primera_compra',  GREATEST(COALESCE(NULLIF(v->>'bono_primera_compra', '')::int, 0), 0)
  )
  FROM (SELECT COALESCE((SELECT valor FROM public.tienda_configuracion WHERE clave = 'programa_de_puntos'), '{}'::jsonb) AS v) c;
$function$;

-- Las categorías de un evento con todas sus subcategorías.
CREATE OR REPLACE FUNCTION public.puntos_categorias_con_hijas(p_categorias bigint[])
RETURNS bigint[] LANGUAGE sql STABLE SET search_path = public AS $function$
  WITH RECURSIVE arbol AS (
    SELECT id FROM public.categories WHERE id = ANY (p_categorias)
    UNION
    SELECT c.id FROM public.categories c JOIN arbol a ON c.parent_id = a.id
  )
  SELECT COALESCE(array_agg(id), '{}'::bigint[]) FROM arbol;
$function$;

-- ── Saldo de un email ────────────────────────────────────────────────────────
-- Los puntos que suman forman lotes con fecha de liberación y de vencimiento; lo que se usa (canjes, vencimientos
-- y ajustes negativos) consume primero los lotes más viejos. Lo vencido que todavía no se registró se descuenta
-- igual, así el saldo es exacto aunque la tarea diaria no haya pasado.
CREATE OR REPLACE FUNCTION public.puntos_saldo_de(p_email text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
  WITH m AS (
    SELECT * FROM public.puntos_movimientos WHERE email = lower(trim(p_email))
  ), lotes AS (
    SELECT * FROM m WHERE tipo IN ('compra', 'bono', 'reverso') OR (tipo = 'ajuste' AND puntos > 0)
  ), t AS (
    SELECT
      COALESCE((SELECT sum(puntos) FROM lotes WHERE disponible_desde <= now()), 0) AS liberado,
      COALESCE((SELECT sum(puntos) FROM lotes WHERE disponible_desde > now()), 0) AS pendiente,
      COALESCE((SELECT sum(puntos) FROM lotes WHERE disponible_desde <= now() AND vence_en <= now()), 0) AS lotes_vencidos,
      COALESCE((SELECT sum(puntos) FROM lotes WHERE disponible_desde <= now() AND vence_en <= now() + interval '30 days'), 0) AS lotes_por_vencer,
      COALESCE((SELECT -sum(puntos) FROM m WHERE tipo IN ('canje', 'devolucion', 'vencimiento') OR (tipo = 'ajuste' AND puntos < 0)), 0) AS usados
  ), s AS (
    SELECT t.*, GREATEST(lotes_vencidos - usados, 0) AS vencido_sin_registrar FROM t
  )
  SELECT jsonb_build_object(
    'disponibles', (liberado - usados - vencido_sin_registrar)::int,
    'pendientes', pendiente::int,
    'por_vencer', GREATEST(GREATEST(lotes_por_vencer - usados, 0) - vencido_sin_registrar, 0)::int,
    'proximo_vencimiento', (
      SELECT min(vence_en) FROM (
        SELECT vence_en, sum(puntos) OVER (ORDER BY vence_en, id) AS acumulado
        FROM lotes WHERE disponible_desde <= now() AND vence_en IS NOT NULL
      ) x WHERE acumulado > s.usados AND vence_en > now()
    ),
    'proxima_liberacion', (SELECT min(disponible_desde) FROM lotes WHERE disponible_desde > now() AND puntos > 0),
    'vencido_sin_registrar', vencido_sin_registrar::int
  )
  FROM s;
$function$;

-- ── Acreditar al entregar ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tienda_acreditar_puntos_de_pedido(p_order_id bigint)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  c           jsonb := public.puntos_config();
  o           public.orders;
  v_email     text;
  v_bruto     numeric;
  v_ponderado numeric;
  v_factor    numeric;
  v_puntos    integer;
  v_desde     timestamptz;
  v_vence     timestamptz;
  v_bono      integer := (c->>'bono_primera_compra')::int;
BEGIN
  IF NOT (c->>'activo')::boolean THEN RETURN 0; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND OR o.origen IS DISTINCT FROM 'tienda' OR o.status <> 'entregado' OR o.comprador_email IS NULL THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.puntos_movimientos WHERE order_id = p_order_id AND tipo = 'compra') THEN RETURN 0; END IF;
  v_email := lower(trim(o.comprador_email));

  -- Cada línea con el multiplicador más alto de los eventos vigentes el día de la compra para su categoría.
  SELECT COALESCE(sum(l.monto), 0), COALESCE(sum(l.monto * COALESCE(ev.mult, 1)), 0)
    INTO v_bruto, v_ponderado
  FROM (
    SELECT COALESCE(oi.precio_final, 0) * COALESCE(oi.quantity, 0) AS monto, p.category_id::bigint AS categoria
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = p_order_id
  ) l
  LEFT JOIN LATERAL (
    SELECT max(e.multiplicador) AS mult
    FROM public.puntos_eventos e
    WHERE e.activo AND o.created_at >= e.desde AND o.created_at < e.hasta
      AND (e.categorias IS NULL OR cardinality(e.categorias) = 0 OR l.categoria = ANY (public.puntos_categorias_con_hijas(e.categorias)))
  ) ev ON true;

  IF v_bruto <= 0 THEN RETURN 0; END IF;
  -- El descuento del cupón baja la base en la misma proporción; el envío nunca suma.
  v_factor := GREATEST(1 - COALESCE(o.discount_amount, 0) / v_bruto, 0);
  v_puntos := floor(v_ponderado * v_factor / (c->>'pesos_por_punto')::numeric);

  v_desde := COALESCE(o.entregado_en, now()) + make_interval(days => (c->>'dias_de_espera')::int);
  v_vence := v_desde + make_interval(months => (c->>'meses_de_vencimiento')::int);

  IF v_puntos > 0 THEN
    INSERT INTO public.puntos_movimientos (email, tipo, puntos, order_id, disponible_desde, vence_en, detalle)
    VALUES (v_email, 'compra', v_puntos, p_order_id, v_desde, v_vence, 'Compra ' || COALESCE(o.order_number, p_order_id::text))
    ON CONFLICT DO NOTHING;
  END IF;

  -- Bono por la primera compra entregada de ese email.
  IF v_bono > 0 AND NOT EXISTS (
    SELECT 1 FROM public.puntos_movimientos WHERE email = v_email AND tipo = 'compra' AND order_id <> p_order_id
  ) THEN
    INSERT INTO public.puntos_movimientos (email, tipo, puntos, order_id, evento, disponible_desde, vence_en, detalle)
    VALUES (v_email, 'bono', v_bono, p_order_id, 'primera_compra', v_desde, v_vence, 'Bono por la primera compra')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN GREATEST(v_puntos, 0);
END;
$function$;

-- ── Revertir al cancelar o reintegrar: anula lo que sumó ese pedido (compra y bono) ──
CREATE OR REPLACE FUNCTION public.tienda_revertir_puntos_de_pedido(p_order_id bigint)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_compra public.puntos_movimientos;
  v_total  integer;
BEGIN
  SELECT * INTO v_compra FROM public.puntos_movimientos WHERE order_id = p_order_id AND tipo = 'compra';
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT COALESCE(sum(puntos), 0) INTO v_total FROM public.puntos_movimientos WHERE order_id = p_order_id AND tipo IN ('compra', 'bono');
  IF v_total <= 0 THEN RETURN 0; END IF;
  INSERT INTO public.puntos_movimientos (email, tipo, puntos, order_id, disponible_desde, vence_en, detalle)
  VALUES (v_compra.email, 'reverso', -v_total, p_order_id, v_compra.disponible_desde, v_compra.vence_en, 'Se anularon los puntos de la compra')
  ON CONFLICT DO NOTHING;
  RETURN v_total;
END;
$function$;

-- Lo dispara el cambio de estado del pedido, venga del panel, de Zipnova o de Mercado Pago. Un error de puntos
-- nunca frena el cambio de estado.
CREATE OR REPLACE FUNCTION public.tienda_puntos_por_estado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF NEW.origen IS DISTINCT FROM 'tienda' THEN RETURN NEW; END IF;
  BEGIN
    IF NEW.status = 'entregado' THEN
      PERFORM public.tienda_acreditar_puntos_de_pedido(NEW.id);
    ELSIF NEW.status IN ('cancelado', 'reintegrado') THEN
      PERFORM public.tienda_revertir_puntos_de_pedido(NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Puntos del pedido %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tienda_puntos_por_estado ON public.orders;
CREATE TRIGGER tienda_puntos_por_estado
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.tienda_puntos_por_estado();

-- ── Lo público: si el programa está activo, cuánto suma y los eventos vigentes ──
CREATE OR REPLACE FUNCTION public.tienda_programa_de_puntos()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
  SELECT jsonb_build_object(
    'activo', (c->>'activo')::boolean,
    'pesos_por_punto', (c->>'pesos_por_punto')::numeric,
    'valor_del_punto', (c->>'valor_del_punto')::numeric,
    'minimo_para_canjear', (c->>'minimo_para_canjear')::int,
    'tope_porcentaje', (c->>'tope_porcentaje')::numeric,
    'dias_de_espera', (c->>'dias_de_espera')::int,
    'meses_de_vencimiento', (c->>'meses_de_vencimiento')::int,
    'eventos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nombre', e.nombre, 'multiplicador', e.multiplicador, 'hasta', e.hasta,
                                          'categorias', COALESCE(e.categorias, '{}'::bigint[])) ORDER BY e.hasta)
      FROM public.puntos_eventos e WHERE e.activo AND now() >= e.desde AND now() < e.hasta
    ), '[]'::jsonb)
  )
  FROM (SELECT public.puntos_config() AS c) x;
$function$;

-- ── Lo del cliente (con la sesión del email confirmado) ──────────────────────
CREATE OR REPLACE FUNCTION public.puntos_historial_de(p_email text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', m.id,
      'tipo', m.tipo,
      'puntos', m.puntos,
      'detalle', m.detalle,
      'fecha', m.creado_en,
      'disponible_desde', m.disponible_desde,
      'vence_en', m.vence_en,
      'compra', (SELECT o.order_number FROM public.orders o WHERE o.id = m.order_id),
      'cupon', (SELECT cp.code FROM public.coupons cp WHERE cp.id = m.cupon_id)
    ) ORDER BY m.creado_en DESC, m.id DESC), '[]'::jsonb)
  FROM (SELECT * FROM public.puntos_movimientos WHERE email = lower(trim(p_email)) ORDER BY creado_en DESC, id DESC LIMIT 200) m;
$function$;

CREATE OR REPLACE FUNCTION public.tienda_mis_puntos()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_email text := public.tienda_email_de_la_sesion();
BEGIN
  IF auth.uid() IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'Entrá a tu cuenta para ver tus puntos.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object(
    'programa', public.tienda_programa_de_puntos(),
    'saldo', public.puntos_saldo_de(v_email),
    'movimientos', public.puntos_historial_de(v_email)
  );
END;
$function$;

-- Bonos por crear la cuenta y por completar Mis datos (si el panel les puso puntos). Se puede llamar siempre:
-- cada bono se acredita una sola vez por email.
CREATE OR REPLACE FUNCTION public.tienda_reclamar_bonos()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  c       jsonb := public.puntos_config();
  v_email text := public.tienda_email_de_la_sesion();
  v_vence timestamptz := now() + make_interval(months => (c->>'meses_de_vencimiento')::int);
  v_suma  integer := 0;
  v_filas integer;
BEGIN
  IF auth.uid() IS NULL OR v_email IS NULL OR NOT (c->>'activo')::boolean THEN RETURN 0; END IF;

  IF (c->>'bono_cuenta')::int > 0 THEN
    INSERT INTO public.puntos_movimientos (email, tipo, puntos, evento, vence_en, detalle)
    VALUES (v_email, 'bono', (c->>'bono_cuenta')::int, 'cuenta', v_vence, 'Bono por crear la cuenta')
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    v_suma := v_suma + v_filas * (c->>'bono_cuenta')::int;
  END IF;

  IF (c->>'bono_datos')::int > 0 AND EXISTS (
    SELECT 1 FROM public.tienda_clientes tc
    WHERE tc.user_id = auth.uid()
      AND length(trim(COALESCE(tc.nombre, ''))) > 1
      AND length(trim(COALESCE(tc.telefono, ''))) > 5
      AND length(trim(COALESCE(tc.documento, ''))) > 5
      AND jsonb_array_length(tc.direcciones) > 0
  ) THEN
    INSERT INTO public.puntos_movimientos (email, tipo, puntos, evento, vence_en, detalle)
    VALUES (v_email, 'bono', (c->>'bono_datos')::int, 'datos', v_vence, 'Bono por completar tus datos')
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_filas = ROW_COUNT;
    v_suma := v_suma + v_filas * (c->>'bono_datos')::int;
  END IF;

  RETURN v_suma;
END;
$function$;

-- Canjear: crea un cupón personal de monto fijo, ya activado en la cuenta. El mínimo de compra del cupón hace
-- cumplir el tope: el descuento nunca pasa del porcentaje del panel. Un bloqueo por email evita que dos pestañas
-- gasten los mismos puntos.
CREATE OR REPLACE FUNCTION public.tienda_canjear_puntos(p_puntos integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $function$
DECLARE
  c          jsonb := public.puntos_config();
  v_email    text := public.tienda_email_de_la_sesion();
  v_saldo    jsonb;
  v_valor    numeric;
  v_minimo   numeric;
  v_codigo   text;
  v_cupon    uuid;
  v_vence    timestamptz;
  v_alfabeto text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
BEGIN
  IF auth.uid() IS NULL OR v_email IS NULL THEN
    RAISE EXCEPTION 'Entrá a tu cuenta para canjear tus puntos.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (c->>'activo')::boolean THEN
    RAISE EXCEPTION 'El programa de puntos no está activo.' USING ERRCODE = 'P0001';
  END IF;
  IF p_puntos IS NULL OR p_puntos < (c->>'minimo_para_canjear')::int THEN
    RAISE EXCEPTION 'El canje mínimo es de % puntos.', (c->>'minimo_para_canjear')::int USING ERRCODE = 'P0001';
  END IF;
  IF (c->>'valor_del_punto')::numeric <= 0 THEN
    RAISE EXCEPTION 'Por ahora no se pueden canjear puntos.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('puntos:' || v_email));
  v_saldo := public.puntos_saldo_de(v_email);
  IF p_puntos > (v_saldo->>'disponibles')::int THEN
    RAISE EXCEPTION 'Tenés % puntos disponibles.', GREATEST((v_saldo->>'disponibles')::int, 0) USING ERRCODE = 'P0001';
  END IF;

  v_valor  := round(p_puntos * (c->>'valor_del_punto')::numeric, 2);
  v_minimo := ceil(v_valor * 100 / (c->>'tope_porcentaje')::numeric);
  v_vence  := now() + make_interval(days => (c->>'dias_del_cupon')::int);

  LOOP
    SELECT 'TP-' || string_agg(substr(v_alfabeto, 1 + (get_byte(r.b, i) % length(v_alfabeto)), 1), '' ORDER BY i)
      INTO v_codigo
      FROM (SELECT gen_random_bytes(8) AS b) r, generate_series(0, 7) AS i;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.coupons WHERE code = v_codigo);
  END LOOP;

  INSERT INTO public.coupons (
    code, discount_type, discount_value, min_purchase, max_discount, max_uses, used_count, expires_at,
    client_id, is_active, email_destino, activado_en
  ) VALUES (
    v_codigo, 'fixed', v_valor, NULLIF(v_minimo, 0), NULL, 1, 0, v_vence,
    auth.uid(), true, v_email, now()
  ) RETURNING id INTO v_cupon;

  INSERT INTO public.puntos_movimientos (email, tipo, puntos, cupon_id, detalle, creado_por)
  VALUES (v_email, 'canje', -p_puntos, v_cupon, 'Canje por un cupón de $ ' || to_char(v_valor, 'FM999G999G990'), auth.uid());

  RETURN jsonb_build_object('codigo', v_codigo, 'valor', v_valor, 'minimo', v_minimo, 'vence_en', v_vence, 'puntos', p_puntos);
END;
$function$;

-- ── Tarea diaria: registra lo vencido y devuelve los puntos de cupones de canje que vencieron sin usarse ──
CREATE OR REPLACE FUNCTION public.tienda_vencer_puntos()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_devueltos integer := 0;
  v_vencidos  integer := 0;
  r           record;
  v_due       integer;
BEGIN
  -- Primero las devoluciones: así lo devuelto vuelve a su lote y vence con él si ya pasó la fecha.
  FOR r IN
    SELECT m.email, m.cupon_id, -m.puntos AS puntos, cp.code
    FROM public.puntos_movimientos m
    JOIN public.coupons cp ON cp.id = m.cupon_id
    WHERE m.tipo = 'canje'
      AND cp.expires_at IS NOT NULL AND cp.expires_at <= now()
      AND COALESCE(cp.used_count, 0) = 0
      AND NOT EXISTS (SELECT 1 FROM public.puntos_movimientos d WHERE d.cupon_id = m.cupon_id AND d.tipo = 'devolucion')
  LOOP
    INSERT INTO public.puntos_movimientos (email, tipo, puntos, cupon_id, detalle)
    VALUES (r.email, 'devolucion', r.puntos, r.cupon_id, 'El cupón ' || r.code || ' venció sin usarse')
    ON CONFLICT DO NOTHING;
    v_devueltos := v_devueltos + 1;
  END LOOP;

  FOR r IN SELECT DISTINCT email FROM public.puntos_movimientos WHERE vence_en <= now() LOOP
    v_due := (public.puntos_saldo_de(r.email)->>'vencido_sin_registrar')::int;
    IF v_due > 0 THEN
      INSERT INTO public.puntos_movimientos (email, tipo, puntos, detalle) VALUES (r.email, 'vencimiento', -v_due, 'Puntos vencidos');
      v_vencidos := v_vencidos + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('devoluciones', v_devueltos, 'vencimientos', v_vencidos);
END;
$function$;

-- ── Panel ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.puntos_es_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
  SELECT lower(COALESCE(public.get_my_role(), '')) = 'admin';
$function$;

CREATE OR REPLACE FUNCTION public.tienda_puntos_panel()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  c jsonb := public.puntos_config();
  v_emitidos integer; v_anulados integer; v_canjeados integer; v_vencidos integer; v_ajustes integer; v_clientes integer;
BEGIN
  IF NOT public.puntos_es_admin() THEN
    RAISE EXCEPTION 'Solo para administradores.' USING ERRCODE = 'P0001';
  END IF;
  SELECT
    COALESCE(sum(puntos) FILTER (WHERE tipo IN ('compra', 'bono')), 0),
    COALESCE(-sum(puntos) FILTER (WHERE tipo = 'reverso'), 0),
    COALESCE(-sum(puntos) FILTER (WHERE tipo IN ('canje', 'devolucion')), 0),
    COALESCE(-sum(puntos) FILTER (WHERE tipo = 'vencimiento'), 0),
    COALESCE(sum(puntos) FILTER (WHERE tipo = 'ajuste'), 0),
    count(DISTINCT email)
  INTO v_emitidos, v_anulados, v_canjeados, v_vencidos, v_ajustes, v_clientes
  FROM public.puntos_movimientos;
  RETURN jsonb_build_object(
    'configuracion', (SELECT valor FROM public.tienda_configuracion WHERE clave = 'programa_de_puntos'),
    'resumen', jsonb_build_object(
      'clientes', v_clientes,
      'emitidos', v_emitidos,
      'anulados', v_anulados,
      'canjeados', v_canjeados,
      'vencidos', v_vencidos,
      'ajustes', v_ajustes,
      'saldo', v_emitidos - v_anulados - v_canjeados - v_vencidos + v_ajustes,
      'saldo_en_pesos', round((v_emitidos - v_anulados - v_canjeados - v_vencidos + v_ajustes) * (c->>'valor_del_punto')::numeric)
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.tienda_puntos_guardar_configuracion(p_valor jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.puntos_es_admin() THEN
    RAISE EXCEPTION 'Solo para administradores.' USING ERRCODE = 'P0001';
  END IF;
  v := jsonb_build_object(
    'activo', COALESCE((p_valor->>'activo')::boolean, false),
    'pesos_por_punto', LEAST(GREATEST(COALESCE((p_valor->>'pesos_por_punto')::numeric, 1000), 1), 1000000),
    'valor_del_punto', LEAST(GREATEST(COALESCE((p_valor->>'valor_del_punto')::numeric, 0), 0), 1000000),
    'dias_de_espera', LEAST(GREATEST(COALESCE((p_valor->>'dias_de_espera')::int, 10), 0), 90),
    'meses_de_vencimiento', LEAST(GREATEST(COALESCE((p_valor->>'meses_de_vencimiento')::int, 12), 1), 60),
    'minimo_para_canjear', LEAST(GREATEST(COALESCE((p_valor->>'minimo_para_canjear')::int, 1), 1), 10000000),
    'tope_porcentaje', LEAST(GREATEST(COALESCE((p_valor->>'tope_porcentaje')::numeric, 30), 1), 100),
    'dias_del_cupon', LEAST(GREATEST(COALESCE((p_valor->>'dias_del_cupon')::int, 60), 1), 365),
    'bono_cuenta', LEAST(GREATEST(COALESCE((p_valor->>'bono_cuenta')::int, 0), 0), 1000000),
    'bono_datos', LEAST(GREATEST(COALESCE((p_valor->>'bono_datos')::int, 0), 0), 1000000),
    'bono_primera_compra', LEAST(GREATEST(COALESCE((p_valor->>'bono_primera_compra')::int, 0), 0), 1000000)
  );
  INSERT INTO public.tienda_configuracion (clave, valor, descripcion, actualizado_en, actualizado_por)
  VALUES ('programa_de_puntos', v, 'Puntos Teqo: cuántos pesos hacen un punto, cuánto vale al canjear, espera, vencimiento, canje y bonos.', now(), auth.uid())
  ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = now(), actualizado_por = auth.uid();
  RETURN v;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tienda_puntos_de_cliente(p_email text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF lower(COALESCE(public.get_my_role(), '')) NOT IN ('admin', 'vendedor') THEN
    RAISE EXCEPTION 'Solo para el equipo.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object(
    'email', lower(trim(p_email)),
    'saldo', public.puntos_saldo_de(p_email),
    'movimientos', public.puntos_historial_de(p_email)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.tienda_ajustar_puntos(p_email text, p_puntos integer, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  c       jsonb := public.puntos_config();
  v_email text := lower(trim(COALESCE(p_email, '')));
BEGIN
  IF NOT public.puntos_es_admin() THEN
    RAISE EXCEPTION 'Solo para administradores.' USING ERRCODE = 'P0001';
  END IF;
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN
    RAISE EXCEPTION 'Revisá el email.' USING ERRCODE = 'P0001';
  END IF;
  IF p_puntos IS NULL OR p_puntos = 0 OR abs(p_puntos) > 10000000 THEN
    RAISE EXCEPTION 'Indicá cuántos puntos sumar o restar.' USING ERRCODE = 'P0001';
  END IF;
  IF length(trim(COALESCE(p_motivo, ''))) < 3 THEN
    RAISE EXCEPTION 'Escribí el motivo del ajuste.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.puntos_movimientos (email, tipo, puntos, vence_en, detalle, creado_por)
  VALUES (
    v_email, 'ajuste', p_puntos,
    CASE WHEN p_puntos > 0 THEN now() + make_interval(months => (c->>'meses_de_vencimiento')::int) END,
    left(trim(p_motivo), 300), auth.uid()
  );
  RETURN public.tienda_puntos_de_cliente(v_email);
END;
$function$;

-- Los cupones de la cuenta dicen si salieron de un canje de puntos.
CREATE OR REPLACE FUNCTION public.tienda_mis_cupones()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'codigo', c.code,
      'tipo', c.discount_type,
      'valor', c.discount_value,
      'minimo', c.min_purchase,
      'tope', c.max_discount,
      'vence_en', c.expires_at,
      'activado', c.client_id IS NOT NULL,
      'usado', c.max_uses IS NOT NULL AND COALESCE(c.used_count, 0) >= c.max_uses,
      'vencido', c.expires_at IS NOT NULL AND c.expires_at <= now(),
      'categorias', COALESCE((SELECT jsonb_agg(cat.name ORDER BY cat.name) FROM public.categories cat WHERE cat.id = ANY (c.categorias)), '[]'::jsonb),
      'compra', (SELECT o.order_number FROM public.orders o WHERE o.id = c.origen_order_id),
      'puntos', (SELECT -m.puntos FROM public.puntos_movimientos m WHERE m.cupon_id = c.id AND m.tipo = 'canje')
    ) ORDER BY c.created_at DESC), '[]'::jsonb)
  FROM public.coupons c
  WHERE auth.uid() IS NOT NULL
    AND c.email_destino IS NOT NULL
    AND (c.client_id = auth.uid() OR (c.client_id IS NULL AND c.email_destino = public.tienda_email_de_la_sesion()));
$function$;

-- ── Permisos ─────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.puntos_config() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.puntos_saldo_de(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.puntos_historial_de(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tienda_acreditar_puntos_de_pedido(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tienda_revertir_puntos_de_pedido(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tienda_vencer_puntos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tienda_acreditar_puntos_de_pedido(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.tienda_revertir_puntos_de_pedido(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.tienda_vencer_puntos() TO service_role;

GRANT EXECUTE ON FUNCTION public.tienda_programa_de_puntos() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.tienda_mis_puntos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tienda_mis_puntos() TO authenticated;
REVOKE ALL ON FUNCTION public.tienda_reclamar_bonos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tienda_reclamar_bonos() TO authenticated;
REVOKE ALL ON FUNCTION public.tienda_canjear_puntos(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tienda_canjear_puntos(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.tienda_puntos_panel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tienda_puntos_panel() TO authenticated;
REVOKE ALL ON FUNCTION public.tienda_puntos_guardar_configuracion(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tienda_puntos_guardar_configuracion(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.tienda_puntos_de_cliente(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tienda_puntos_de_cliente(text) TO authenticated;
REVOKE ALL ON FUNCTION public.tienda_ajustar_puntos(text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tienda_ajustar_puntos(text, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public.tienda_mis_cupones() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tienda_mis_cupones() TO authenticated;

-- ── Tarea diaria (03:15 de Argentina) ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
DO $cron$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'tienda-vencer-puntos';
  PERFORM cron.schedule('tienda-vencer-puntos', '15 6 * * *', 'SELECT public.tienda_vencer_puntos()');
END;
$cron$;
